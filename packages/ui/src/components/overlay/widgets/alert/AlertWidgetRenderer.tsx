"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useGoogleFonts } from "../../hooks/use-google-font";
import { subscribeToWsRoom } from "../../lib/ws-store";
import type { OverlayItem, OverlayScene } from "../../types";
import {
  ALERT_EVENT_TYPES,
  ALERT_TEST_BROWSER_EVENT,
  alertAmountText,
  alertInstanceFromSocketMessage,
  alertSkipReason,
  normalizeAlertWidgetConfig,
  renderAlertTemplate,
  type AlertInstance,
  type AlertTestBrowserEventDetail,
  type AlertVariantConfig,
} from "./alert-widget-config";

export interface AlertWidgetRendererProps {
  item: OverlayItem;
  /** Needed for the live WS subscription; the editor canvas also passes it. */
  scene?: OverlayScene;
  /**
   * Editor flag: shows a placeholder while idle so the box stays visible on the
   * canvas. The WS subscription runs either way -- only Local-mode tests take
   * the `streamwizard:test-alert` browser event instead.
   */
  isEditor?: boolean;
}

type Phase = "in" | "hold" | "out";

interface ActiveAlert {
  alert: AlertInstance;
  variant: AlertVariantConfig;
}

const IN_MS = 500;
const OUT_MS = 350;
/** Floor for a media-matched hold, so a half-second video does not just blink. */
const MIN_HOLD_MS = 1000;
/** Ceiling for a media-matched hold — an hour-long file must not park the overlay. */
const MAX_HOLD_MS = 60_000;

const KEYFRAMES = `
@keyframes sw-alert-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes sw-alert-slide-up-in { from { opacity: 0; transform: translateY(32px) } to { opacity: 1; transform: translateY(0) } }
@keyframes sw-alert-slide-down-in { from { opacity: 0; transform: translateY(-32px) } to { opacity: 1; transform: translateY(0) } }
@keyframes sw-alert-zoom-in { from { opacity: 0; transform: scale(0.8) } to { opacity: 1; transform: scale(1) } }
@keyframes sw-alert-bounce-in {
  0% { opacity: 0; transform: scale(0.6) }
  60% { opacity: 1; transform: scale(1.08) }
  80% { transform: scale(0.97) }
  100% { opacity: 1; transform: scale(1) }
}
@keyframes sw-alert-fade-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes sw-alert-slide-down-out { from { opacity: 1; transform: translateY(0) } to { opacity: 0; transform: translateY(24px) } }
@keyframes sw-alert-zoom-out { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(0.85) } }
@media (prefers-reduced-motion: reduce) {
  .sw-alert-anim { animation-duration: 1ms !important; }
}
`;

const IN_ANIMATION: Record<AlertVariantConfig["animationIn"], string> = {
  fade: "sw-alert-fade-in",
  slide_up: "sw-alert-slide-up-in",
  slide_down: "sw-alert-slide-down-in",
  zoom: "sw-alert-zoom-in",
  bounce: "sw-alert-bounce-in",
};

const OUT_ANIMATION: Record<AlertVariantConfig["animationOut"], string> = {
  fade: "sw-alert-fade-out",
  slide_down: "sw-alert-slide-down-out",
  zoom: "sw-alert-zoom-out",
};

/**
 * Renders a title template as React nodes with `{name}` / `{amount}`
 * highlighted in the accent color.
 */
function renderAccentedTemplate(
  template: string,
  alert: AlertInstance,
  accentColor: string
): ReactNode[] {
  const parts = template.split(/(\{name\}|\{amount\})/g);
  return parts.map((part, i) => {
    if (part === "{name}" || part === "{amount}") {
      return (
        <span key={i} style={{ color: accentColor }}>
          {part === "{name}" ? alert.name : alertAmountText(alert)}
        </span>
      );
    }
    return <span key={i}>{renderAlertTemplate(part, alert)}</span>;
  });
}

export function AlertWidgetRenderer({ item, scene, isEditor = false }: AlertWidgetRendererProps) {
  const cfg = useMemo(() => normalizeAlertWidgetConfig(item.config), [item.config]);
  const fontFamilies = useMemo(
    () => [...new Set(ALERT_EVENT_TYPES.map((e) => cfg.variants[e].fontFamily))],
    [cfg]
  );
  useGoogleFonts(fontFamilies);


  const [active, setActive] = useState<ActiveAlert | null>(null);
  const [phase, setPhase] = useState<Phase>("in");

  const queueRef = useRef<ActiveAlert[]>([]);
  const busyRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  // The out/next pair is rescheduled once a media-matched video reports its
  // real length, so both live in refs instead of the fire-and-forget list.
  const startedAtRef = useRef(0);
  const inTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playNextRef = useRef<() => void>(() => {});

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
  };

  /**
   * Schedules the exit (and the alert after it), `outAtMs` after this alert
   * started. Safe to call again mid-alert: the pending pair is replaced.
   */
  const scheduleOut = useCallback((outAtMs: number) => {
    const c = cfgRef.current;
    if (outTimerRef.current) clearTimeout(outTimerRef.current);
    if (doneTimerRef.current) clearTimeout(doneTimerRef.current);

    const floor = IN_MS + MIN_HOLD_MS;
    const target = Math.min(IN_MS + MAX_HOLD_MS, Math.max(floor, outAtMs));
    const outIn = Math.max(0, target - (Date.now() - startedAtRef.current));

    outTimerRef.current = setTimeout(() => setPhase("out"), outIn);
    doneTimerRef.current = setTimeout(
      () => {
        stopAudio();
        setActive(null);
        playNextRef.current();
      },
      outIn + OUT_MS + c.gapSeconds * 1000
    );
  }, []);

  const playNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      busyRef.current = false;
      setActive(null);
      return;
    }
    busyRef.current = true;
    const c = cfgRef.current;

    startedAtRef.current = Date.now();
    setActive(next);
    setPhase("in");

    const soundUrl = next.variant.soundUrl;
    if (soundUrl) {
      const audio = new Audio(soundUrl);
      audio.volume = Math.min(1, Math.max(0, next.variant.volume * c.masterVolume));
      audioRef.current = audio;
      audio.play().catch(() => {});
    }

    if (inTimerRef.current) clearTimeout(inTimerRef.current);
    inTimerRef.current = setTimeout(() => setPhase("hold"), IN_MS);
    // Media-matched alerts start on this too: it is the fallback if the video's
    // length never resolves, and the cap if playback stalls forever.
    scheduleOut(IN_MS + next.variant.durationSeconds * 1000);
  }, [scheduleOut]);
  playNextRef.current = playNext;

  const enqueue = useCallback(
    (alert: AlertInstance) => {
      const c = cfgRef.current;
      const variant = c.variants[alert.event];
      if (alertSkipReason(alert, variant)) return;
      queueRef.current.push({ alert, variant });
      if (!busyRef.current) playNext();
    },
    [playNext]
  );

  // Real + test events over the scene's WS room. The editor canvas joins it
  // too: custom widgets on the same canvas already do, so an alert box that sat
  // out read as broken next to one that reacted. It also means a Live test --
  // and a real sub mid-edit -- plays in the preview and on every open overlay
  // at once, which is the point of Live.
  useEffect(() => {
    const token = scene?.subscriber_token;
    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => {
      const alert = alertInstanceFromSocketMessage(
        raw as { type?: string; payload?: unknown }
      );
      if (alert) enqueue(alert);
    });
  }, [scene?.subscriber_token, enqueue]);

  // Editor: local test fires from the inspector and the demo bar (no server
  // round-trip). Anything that isn't an alert maps to null and is ignored.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onTest = (e: Event) => {
      const detail = (e as CustomEvent<AlertTestBrowserEventDetail>).detail;
      if (!detail || (scene && detail.sceneId !== scene.id)) return;
      const alert = alertInstanceFromSocketMessage(detail.message);
      if (alert) enqueue(alert);
    };
    window.addEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
    return () => window.removeEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
  }, [scene, enqueue]);

  // Cleanup timers/audio on unmount.
  useEffect(() => {
    const timers = [inTimerRef, outTimerRef, doneTimerRef];
    return () => {
      for (const t of timers) if (t.current) clearTimeout(t.current);
      stopAudio();
    };
  }, []);

  if (!active) {
    if (!isEditor) return null;
    // Canvas placeholder so the (invisible while idle) box stays findable.
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1.5px dashed rgba(158,122,255,0.5)",
          borderRadius: 8,
          color: "rgba(255,255,255,0.55)",
          fontFamily: "sans-serif",
          fontSize: 14,
          textAlign: "center",
          padding: 8,
        }}
      >
        Alert box — use Test in the panel to preview
      </div>
    );
  }

  const { alert, variant } = active;
  const fontFamily = `"${variant.fontFamily}", sans-serif`;
  const textShadow = variant.textShadow ? "0 2px 8px rgba(0,0,0,0.6)" : "none";
  const alignItems =
    variant.align === "left"
      ? "flex-start"
      : variant.align === "right"
        ? "flex-end"
        : "center";
  const mediaUrl = variant.mediaUrl;
  const mediaKind = variant.mediaKind;
  const hasSeparateSound = Boolean(variant.soundUrl);
  const videoVolume = hasSeparateSound
    ? 0
    : Math.min(1, Math.max(0, variant.volume * cfg.masterVolume));
  // Only a video can drive its own timing; without one the fixed duration
  // already scheduled in playNext stands.
  const matchVideo = mediaKind === "video" && variant.durationMode === "media";

  const media =
    mediaUrl && mediaKind === "video" ? (
      <video
        key={mediaUrl}
        src={mediaUrl}
        autoPlay
        loop={!matchVideo}
        playsInline
        muted={videoVolume === 0}
        ref={(el) => {
          if (el) el.volume = videoVolume;
        }}
        onLoadedMetadata={(e) => {
          if (!matchVideo) return;
          // Streamed WebM often reports Infinity until it is seeked; leave the
          // fixed duration in place and let onEnded close the alert instead.
          const d = e.currentTarget.duration;
          if (!Number.isFinite(d) || d <= 0) return;
          scheduleOut(d * 1000);
        }}
        onEnded={() => {
          if (!matchVideo) return;
          scheduleOut(Date.now() - startedAtRef.current);
        }}
        style={{
          maxWidth: "100%",
          maxHeight: variant.layout === "overlay" ? "100%" : "60%",
          objectFit: "contain",
          ...(variant.layout === "overlay"
            ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%" }
            : {}),
        }}
      />
    ) : mediaUrl && mediaKind === "image" ? (
      <img
        src={mediaUrl}
        alt=""
        style={{
          maxWidth: "100%",
          maxHeight: variant.layout === "overlay" ? "100%" : "60%",
          objectFit: "contain",
          ...(variant.layout === "overlay"
            ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%" }
            : {}),
        }}
      />
    ) : null;

  const title = (
    <div
      style={{
        color: variant.titleColor,
        fontSize: variant.fontSize,
        fontWeight: variant.fontWeight,
        fontFamily,
        textAlign: variant.align,
        textShadow,
        lineHeight: 1.2,
        wordBreak: "break-word",
      }}
    >
      {renderAccentedTemplate(variant.titleTemplate, alert, variant.accentColor)}
    </div>
  );

  const messageText = variant.messageTemplate
    ? renderAlertTemplate(variant.messageTemplate, alert).trim()
    : "";
  const message = messageText ? (
    <div
      style={{
        color: variant.messageColor,
        fontSize: Math.round(variant.fontSize * 0.6),
        fontWeight: 400,
        fontFamily,
        textAlign: variant.align,
        textShadow,
        lineHeight: 1.3,
        wordBreak: "break-word",
      }}
    >
      {messageText}
    </div>
  ) : null;

  const animation =
    phase === "in"
      ? `${IN_ANIMATION[variant.animationIn]} ${IN_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both`
      : phase === "out"
        ? `${OUT_ANIMATION[variant.animationOut]} ${OUT_MS}ms ease-in both`
        : "none";

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
      <style>{KEYFRAMES}</style>
      <div
        className="sw-alert-anim"
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          position: "relative",
          display: "flex",
          flexDirection: variant.layout === "row" ? "row" : "column",
          alignItems: variant.layout === "row" ? "center" : alignItems,
          justifyContent: "center",
          gap: 12,
          padding: 8,
          animation,
        }}
      >
        {media}
        <div
          style={{
            position: variant.layout === "overlay" ? "relative" : "static",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems,
            gap: 4,
            minWidth: 0,
          }}
        >
          {title}
          {message}
        </div>
      </div>
    </div>
  );
}
