"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClipsWidgetConfig, DisplayFieldKey, ClipDataRow } from "../../types";
import { formatClipField } from "../../lib/format-clip-fields";
import { describeMediaError } from "./media-error";

/** Opaque to the renderer — handed back to `fetchNextClip` to continue the rotation. */
export type ClipRotationCursor = unknown;

export interface NextClipResult {
  clip: ClipDataRow;
  videoUrl: string;
  cursor: ClipRotationCursor;
}

export interface ClipsWidgetRendererProps {
  /**
   * Fetches the next clip to play, already carrying a playable URL. Called once
   * per transition; the renderer keeps one clip buffered ahead so this never
   * blocks what is on screen. Returns null when nothing matches the filters.
   */
  fetchNextClip: (
    cursor: ClipRotationCursor,
    excludeClipIds: string[]
  ) => Promise<NextClipResult | null>;
  /** Composite config including display field visibility, layout, and playback settings. */
  config: ClipsWidgetConfig;
}

/** How long a clip stays ineligible for a random re-draw. */
const RECENTLY_PLAYED_MS = 10 * 60 * 1000;

/** Give up waiting for `canplay` and swap anyway rather than freezing the rotation. */
const BUFFER_TIMEOUT_MS = 8000;

const SLOT_COUNT = 3;

const DEFAULT_FIELD_LAYOUT = { x: 0, y: 88, w: 100, h: 12, fontSize: 16 };

type Slot = {
  clip: ClipDataRow;
  videoUrl: string;
};

const EMPTY_STATE_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.85)",
  color: "#888",
  fontFamily: "system-ui, sans-serif",
  fontSize: 14,
};

/**
 * Three `<video>` elements in a ring: one visible, one fully buffered behind it,
 * one being fetched. A clip transition promotes the buffered element and starts
 * the next fetch, so the widget never shows a loading state mid-rotation.
 */
export function ClipsWidgetRenderer({
  fetchNextClip,
  config,
}: ClipsWidgetRendererProps) {
  const isRandomMode = config.sort === "random";

  const clipCrossfadeMs = useMemo(() => {
    if (config.clipTransition !== "crossfade") return 0;
    return Math.min(3000, Math.max(200, config.clipTransitionMs));
  }, [config.clipTransition, config.clipTransitionMs]);

  const videoOpacityTransitionStyle = useMemo(
    () =>
      ({
        transitionProperty: "opacity",
        transitionDuration: clipCrossfadeMs > 0 ? `${clipCrossfadeMs}ms` : "0ms",
        transitionTimingFunction: "ease-in-out",
      }) satisfies CSSProperties,
    [clipCrossfadeMs]
  );

  const [slots, setSlots] = useState<(Slot | null)[]>(() =>
    Array.from({ length: SLOT_COUNT }, () => null)
  );
  const [activeSlot, setActiveSlot] = useState(0);
  const [status, setStatus] = useState<"initial" | "playing" | "empty">("initial");

  const videoRefs = useRef<(HTMLVideoElement | null)[]>(
    Array.from({ length: SLOT_COUNT }, () => null)
  );
  const cursorRef = useRef<ClipRotationCursor>(null);
  const recentlyPlayedRef = useRef<Map<string, number>>(new Map());
  const transitioningRef = useRef(false);
  const mountedRef = useRef(true);
  /** Serialises fetches — two transitions must not race for the same cursor. */
  const fillQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  /** Mirrors `slots` for reads inside async work, where state would be stale. */
  const slotsRef = useRef<(Slot | null)[]>(slots);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const recentlyPlayedIds = useCallback((): string[] => {
    if (!isRandomMode) return [];
    const now = Date.now();
    const ids: string[] = [];
    for (const [clipId, playedAt] of recentlyPlayedRef.current) {
      if (now - playedAt > RECENTLY_PLAYED_MS) {
        recentlyPlayedRef.current.delete(clipId);
      } else {
        ids.push(clipId);
      }
    }
    return ids;
  }, [isRandomMode]);

  /** Resolves once the element can play through, or once we stop waiting on it. */
  const waitForBuffer = useCallback(
    (el: HTMLVideoElement, slotIndex: number): Promise<void> => {
      if (el.readyState >= 3) return Promise.resolve();

      return new Promise<void>((resolve) => {
        let settled = false;
        const finish = (reason: string) => {
          if (settled) return;
          settled = true;
          el.removeEventListener("canplay", onCanPlay);
          el.removeEventListener("error", onError);
          window.clearTimeout(timeoutId);
          if (reason !== "canplay") {
            console.warn(
              `[clips] slot ${slotIndex} buffer ended on "${reason}"`,
              describeMediaError(el)
            );
          }
          resolve();
        };
        const onCanPlay = () => finish("canplay");
        const onError = () => finish("error");
        const timeoutId = window.setTimeout(
          () => finish(`timeout after ${BUFFER_TIMEOUT_MS}ms`),
          BUFFER_TIMEOUT_MS
        );
        el.addEventListener("canplay", onCanPlay);
        el.addEventListener("error", onError);
      });
    },
    []
  );

  /**
   * Loads the next clip into `slotIndex` and buffers it. Queued rather than
   * dropped when another fill is in flight: a clip ending mid-prefetch must wait
   * its turn, not bail and leave the rotation stuck.
   */
  const fillSlot = useCallback(
    (slotIndex: number): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        try {
          const excluded = recentlyPlayedIds();
          console.log(`[clips] slot ${slotIndex}: requesting next clip`, {
            excludedCount: excluded.length,
          });

          const next = await fetchNextClip(cursorRef.current, excluded);
          if (!mountedRef.current) return false;
          if (!next) {
            console.warn(`[clips] slot ${slotIndex}: no clip returned`);
            return false;
          }

          console.log(`[clips] slot ${slotIndex}: got "${next.clip.title}"`, {
            clipId: next.clip.clipId,
            videoUrl: next.videoUrl,
          });

          cursorRef.current = next.cursor;
          const slot = { clip: next.clip, videoUrl: next.videoUrl };
          slotsRef.current = slotsRef.current.map((existing, i) =>
            i === slotIndex ? slot : existing
          );
          setSlots(slotsRef.current);

          const el = videoRefs.current[slotIndex];
          if (!el) {
            // Previously silent, and it meant the clip never played: the fill
            // had nowhere to attach a src.
            console.error(
              `[clips] slot ${slotIndex}: no <video> element to load into`
            );
            return false;
          }

          el.src = next.videoUrl;
          el.load();
          await waitForBuffer(el, slotIndex);
          console.log(`[clips] slot ${slotIndex}: buffered`, {
            readyState: el.readyState,
            duration: el.duration,
            ...describeMediaError(el),
          });
          return true;
        } catch (err) {
          console.error(`[clips] slot ${slotIndex}: fill failed`, err);
          return false;
        }
      };

      const chained = fillQueueRef.current.then(run, run);
      fillQueueRef.current = chained.catch(() => undefined);
      return chained;
    },
    [fetchNextClip, recentlyPlayedIds, waitForBuffer]
  );

  // First clip: fill the visible slot, then buffer the one behind it.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      console.log("[clips] widget mounted, loading first clip");
      const ok = await fillSlot(0);
      if (cancelled || !mountedRef.current) return;

      if (!ok) {
        console.warn("[clips] first clip failed — showing empty state");
        setStatus("empty");
        return;
      }

      setStatus("playing");
      videoRefs.current[0]
        ?.play()
        .catch((err) => console.warn("[clips] slot 0 autoplay rejected", err));
      await fillSlot(1);
    })();

    return () => {
      cancelled = true;
    };
    // Rotation restarts only when the widget's clip source changes.
  }, [fetchNextClip]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback(async () => {
    if (transitioningRef.current) {
      console.log("[clips] advance ignored — transition already running");
      return;
    }
    transitioningRef.current = true;

    try {
      const current = activeSlot;
      const nextSlot = (current + 1) % SLOT_COUNT;
      const followingSlot = (current + 2) % SLOT_COUNT;
      console.log(`[clips] advancing ${current} -> ${nextSlot}`);

      // The buffered slot may be missing if the previous fetch failed — fetch it
      // now. Costs a visible pause, but only in the already-degraded case.
      if (!slotsRef.current[nextSlot]) {
        console.warn(
          `[clips] slot ${nextSlot} was not buffered — fetching inline (visible stall)`
        );
        const filled = await fillSlot(nextSlot);
        if (!filled || !mountedRef.current) return;
      }

      const nextEl = videoRefs.current[nextSlot];
      if (nextEl) {
        await waitForBuffer(nextEl, nextSlot);
        if (!mountedRef.current) return;
        nextEl.currentTime = 0;
        nextEl
          .play()
          .catch((err) =>
            console.warn(`[clips] slot ${nextSlot} play rejected`, err)
          );
      }

      const outgoing = slotsRef.current[current];
      if (outgoing) {
        recentlyPlayedRef.current.set(outgoing.clip.clipId, Date.now());
      }

      setActiveSlot(nextSlot);

      // Let the crossfade finish before stopping the clip that just left.
      const outgoingEl = videoRefs.current[current];
      if (outgoingEl) {
        window.setTimeout(() => {
          outgoingEl.pause();
        }, clipCrossfadeMs);
      }

      // Refill the slot we just vacated so one clip is always buffered ahead.
      void fillSlot(followingSlot);
    } finally {
      transitioningRef.current = false;
    }
  }, [activeSlot, fillSlot, waitForBuffer, clipCrossfadeMs]);

  useEffect(() => {
    for (const el of videoRefs.current) {
      if (!el) continue;
      el.muted = config.clipMuted;
      el.volume = config.clipVolume;
    }
  }, [config.clipMuted, config.clipVolume]);

  const currentClip = slots[activeSlot]?.clip;

  // The players stay mounted in every state. Returning a bare status message
  // instead would unmount them, and the first fill runs before the widget has
  // any clip — with no element to attach it to, the first clip's src was never
  // set and it silently never played.
  const statusMessage =
    status === "initial"
      ? "Loading clips…"
      : status === "empty"
        ? "No clips match this widget."
        : null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#000",
      }}
    >
      {Array.from({ length: SLOT_COUNT }, (_, slotIndex) => (
        <video
          key={slotIndex}
          ref={(el) => {
            videoRefs.current[slotIndex] = el;
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: activeSlot === slotIndex ? 1 : 0,
            zIndex: activeSlot === slotIndex ? 1 : 0,
            ...videoOpacityTransitionStyle,
          }}
          muted={config.clipMuted}
          playsInline
          onEnded={() => {
            console.log(`[clips] slot ${slotIndex}: ended`);
            if (activeSlot === slotIndex) void advance();
          }}
          onError={() => {
            // The element never sees the HTTP status behind the failure — a
            // proxy 502/503 arrives here as a bare MEDIA_ERR_SRC_NOT_SUPPORTED.
            // Log the src so it can be replayed with curl.
            console.error(
              `[clips] slot ${slotIndex}: video error`,
              describeMediaError(videoRefs.current[slotIndex])
            );
            if (activeSlot === slotIndex) void advance();
          }}
        />
      ))}

      {statusMessage ? (
        <div style={{ ...EMPTY_STATE_STYLE, position: "absolute", inset: 0, zIndex: 4 }}>
          {statusMessage}
        </div>
      ) : null}

      {currentClip && !statusMessage ? (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {config.displayFieldOrder.map((key: DisplayFieldKey) => {
            if (!config.displayFields[key]) return null;
            const layout = config.displayFieldLayouts[key] ?? DEFAULT_FIELD_LAYOUT;
            return (
              <div
                key={key}
                style={{
                  position: "absolute",
                  left: `${layout.x}%`,
                  top: `${layout.y}%`,
                  width: `${layout.w}%`,
                  height: `${layout.h}%`,
                  fontSize: layout.fontSize,
                  color: "#fff",
                  fontFamily: "system-ui, sans-serif",
                  fontWeight: 600,
                  textShadow: "0 1px 4px rgba(0,0,0,0.85)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  overflow: "hidden",
                  boxSizing: "border-box",
                  padding: "2px 6px",
                }}
              >
                <span
                  style={{
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    width: "100%",
                  }}
                >
                  {formatClipField(
                    {
                      title: currentClip.title,
                      creatorName: currentClip.creatorName,
                      gameName: currentClip.gameName,
                      createdAtTwitch: currentClip.createdAtTwitch,
                      viewCount: currentClip.viewCount,
                      durationSec: currentClip.durationSec,
                    },
                    key
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
