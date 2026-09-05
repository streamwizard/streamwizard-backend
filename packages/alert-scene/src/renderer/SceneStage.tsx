"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { effectsFilterList, hasTint, tintArithmetic, tintFilterId } from "../core/effects";
import { evaluate } from "../core/evaluate";
import { splitGraphemes } from "../core/text-preset";
import { substituteTokens } from "../core/tokens";
import type { AlertScene, Clip, ClipEffects, ClipSource, Layer, RenderNode } from "../core/types";
import { applyNode, createStageNode, hideNode, invalidateText, type StageNode } from "./apply-render-state";
import { createMediaSyncState, syncMedia, type MediaSyncState } from "./media-sync";

export interface SceneStageHandle {
  /** Paints the scene at `timeMs`. Pure in (scene, time); safe to call every frame or once after a seek. */
  render(timeMs: number, opts?: { playing?: boolean }): void;
  /** Last time painted. */
  getTime(): number;
}

export interface SceneStageProps {
  scene: AlertScene;
  /** `{token}` values for text clips. */
  tokens?: Record<string, string>;
  /** Scale the scene to sit inside this box (contain, centred). Omit for native size. */
  fit?: { width: number; height: number } | null;
  /** Master volume 0..1, multiplied into every clip's own volume. */
  volume?: number;
  muted?: boolean;
  /** Painted before the first `render()` call; usually 0. */
  initialTime?: number;
  className?: string;
  style?: CSSProperties;
}

interface Entry {
  node: StageNode;
  sync: MediaSyncState | null;
}

const EMPTY_TOKENS: Record<string, string> = {};

let stageCounter = 0;

function effectsStyle(effects: ClipEffects, tintId: string): CSSProperties {
  const filters = effectsFilterList(effects, tintId);
  return {
    mixBlendMode: effects.blendMode === "normal" ? undefined : effects.blendMode,
    filter: filters.length ? filters.join(" ") : undefined,
  };
}

/**
 * One SVG filter per tinted clip: the tint colour cut to the clip's own alpha,
 * mixed into the source by `amount`. Static markup, so it is as deterministic
 * as the rest of the styles. The region reaches one box in every direction so
 * text that spills out of its box stays tinted; beyond that it is clipped.
 */
function TintFilterDefs({ scene, stageId }: { scene: AlertScene; stageId: string }) {
  const tinted: Clip[] = [];
  for (const layer of scene.layers) for (const clip of layer.clips) if (hasTint(clip.effects)) tinted.push(clip);
  if (tinted.length === 0) return null;
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        {tinted.map((clip) => {
          const tint = clip.effects.tint!;
          const { k2, k3 } = tintArithmetic(tint.amount);
          return (
            <filter key={clip.id} id={tintFilterId(stageId, clip.id)} colorInterpolationFilters="sRGB" x="-100%" y="-100%" width="300%" height="300%">
              <feFlood floodColor={tint.color} result="flood" />
              <feComposite in="flood" in2="SourceAlpha" operator="in" result="tint" />
              <feComposite in="SourceGraphic" in2="tint" operator="arithmetic" k1="0" k2={k2} k3={k3} k4="0" />
            </filter>
          );
        })}
      </defs>
    </svg>
  );
}

function textStyle(src: Extract<ClipSource, { kind: "text" }>): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: src.align === "left" ? "flex-start" : src.align === "right" ? "flex-end" : "center",
    textAlign: src.align,
    fontFamily: `"${src.fontFamily}", sans-serif`,
    fontSize: src.fontSize,
    fontWeight: src.fontWeight,
    color: src.color,
    lineHeight: src.lineHeight,
    letterSpacing: src.letterSpacing ? `${src.letterSpacing}px` : undefined,
    textShadow: src.shadow ? "0 2px 8px rgba(0,0,0,0.6)" : undefined,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflow: "visible",
  };
}

/**
 * A preset text clip keeps every grapheme in the DOM as an inline span, so
 * the box, the wrapping and the centring are those of the full string from
 * the first frame; `applyNode` paints only what the preset reveals. Inline
 * (not inline-block) so the browser breaks lines exactly as it would for the
 * plain string; the stagger lift uses `top`, which inline boxes honour.
 */
function PresetText({ src, text }: { src: Extract<ClipSource, { kind: "text" }>; text: string }) {
  const spanStyle: CSSProperties = src.preset === "stagger" ? { position: "relative", opacity: 0 } : { visibility: "hidden" };
  return (
    <div style={textStyle(src)} data-text-preset={src.preset}>
      <span>
        {splitGraphemes(text).map((g, i) => (
          <span key={i} data-grapheme="" style={spanStyle}>
            {g}
          </span>
        ))}
      </span>
    </div>
  );
}

function ClipContent({
  clip,
  tokens,
  mediaRef,
}: {
  clip: Clip;
  tokens: Record<string, string>;
  mediaRef: (el: HTMLMediaElement | null) => void;
}) {
  const src = clip.source;
  switch (src.kind) {
    case "text": {
      const text = substituteTokens(src.text, tokens);
      if (src.preset !== "none") return <PresetText src={src} text={text} />;
      return <div style={textStyle(src)}>{text}</div>;
    }
    case "image":
      return src.url ? (
        <img
          src={src.url}
          alt=""
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: src.fit, display: "block", pointerEvents: "none" }}
        />
      ) : null;
    case "video":
      return src.url ? (
        <video
          ref={mediaRef}
          src={src.url}
          playsInline
          preload="auto"
          style={{ width: "100%", height: "100%", objectFit: src.fit, display: "block", pointerEvents: "none" }}
        />
      ) : null;
    case "audio":
      return src.url ? <audio ref={mediaRef} src={src.url} preload="auto" /> : null;
    case "shape":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: src.fill,
            borderRadius: src.shape === "ellipse" ? "50%" : src.radius,
            border: src.strokeWidth > 0 ? `${src.strokeWidth}px solid ${src.stroke}` : undefined,
            boxSizing: "border-box",
          }}
        />
      );
  }
}

/**
 * Paints an alert scene. React owns the structure (one element per clip,
 * mounted for the scene's whole life); `render(t)` writes the per-frame
 * numbers imperatively so playback never re-renders React. Used by the editor
 * preview and the live overlay alike.
 */
export const SceneStage = forwardRef<SceneStageHandle, SceneStageProps>(function SceneStage(
  { scene, tokens = EMPTY_TOKENS, fit = null, volume = 1, muted = false, initialTime = 0, className, style },
  ref
) {
  const [stageId] = useState(() => `s${++stageCounter}`);
  const entries = useRef(new Map<string, Entry>());
  const pendingMedia = useRef(new Map<string, HTMLMediaElement | null>());
  const timeRef = useRef(initialTime);
  const playingRef = useRef(false);
  // Latest props for the frame loop, mirrored in a layout effect so nothing
  // reads or writes a ref during render.
  const sceneRef = useRef(scene);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  useLayoutEffect(() => {
    sceneRef.current = scene;
    volumeRef.current = volume;
    mutedRef.current = muted;
  });

  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  const paint = useCallback((timeMs: number, playing: boolean) => {
    timeRef.current = timeMs;
    playingRef.current = playing;
    const state = evaluate(sceneRef.current, timeMs);
    const active = new Set<string>();
    const t = now();
    for (const node of state.nodes) {
      active.add(node.clipId);
      const entry = entries.current.get(node.clipId);
      if (!entry) continue;
      applyNode(entry.node, node);
      if (entry.node.media && entry.sync) {
        syncMedia(
          entry.node.media,
          entry.sync,
          {
            mediaTimeMs: node.mediaTime,
            playing,
            volume: node.volume * volumeRef.current,
            muted: mutedRef.current,
            loop: node.source.kind === "video" ? node.source.loop : false,
          },
          t
        );
      }
    }
    for (const [clipId, entry] of entries.current) {
      if (active.has(clipId)) continue;
      hideNode(entry.node);
      if (entry.node.media && !entry.node.media.paused) entry.node.media.pause();
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      render: (timeMs, opts) => paint(timeMs, opts?.playing ?? false),
      getTime: () => timeRef.current,
    }),
    [paint]
  );

  // Structure changed (clip added/removed, source edited): repaint the current
  // time so the new element gets its numbers before the next frame. Preset
  // text spans may have been re-rendered too, so they are collected afresh.
  useEffect(() => {
    for (const entry of entries.current.values()) invalidateText(entry.node);
    paint(timeRef.current, playingRef.current);
  }, [scene, tokens, paint]);

  // Unmount: stop sound. The elements leave the DOM with the component, so the
  // browser frees their decoders; stripping `src` here would also break the
  // StrictMode remount in development, where the same elements come back.
  useEffect(() => {
    const map = entries.current;
    return () => {
      for (const entry of map.values()) {
        if (entry.node.media && !entry.node.media.paused) entry.node.media.pause();
      }
    };
  }, []);

  const registerClip = useCallback(
    (clipId: string) => (el: HTMLDivElement | null) => {
      if (!el) {
        const prev = entries.current.get(clipId);
        if (prev) {
          prev.sync?.detach();
          if (prev.node.media && !prev.node.media.paused) prev.node.media.pause();
          entries.current.delete(clipId);
        }
        return;
      }
      const media = pendingMedia.current.get(clipId) ?? null;
      const node = createStageNode(el, media);
      el.style.display = "none";
      entries.current.set(clipId, { node, sync: media ? createMediaSyncState(media) : null });
    },
    []
  );

  // Media refs fire before the wrapper ref (children mount first), so they park
  // here until the wrapper registers.
  const registerMedia = useCallback(
    (clipId: string) => (el: HTMLMediaElement | null) => {
      pendingMedia.current.set(clipId, el);
      const entry = entries.current.get(clipId);
      if (entry && entry.node.media !== el) {
        entry.sync?.detach();
        entry.node.media = el;
        entry.sync = el ? createMediaSyncState(el) : null;
      }
    },
    []
  );

  const scale = useMemo(() => {
    if (!fit) return 1;
    return Math.min(fit.width / scene.width, fit.height / scene.height);
  }, [fit, scene.width, scene.height]);

  const outerStyle: CSSProperties = {
    position: "relative",
    width: fit ? fit.width : scene.width,
    height: fit ? fit.height : scene.height,
    overflow: "visible",
    ...style,
  };

  const innerStyle: CSSProperties = {
    position: "absolute",
    left: fit ? (fit.width - scene.width * scale) / 2 : 0,
    top: fit ? (fit.height - scene.height * scale) / 2 : 0,
    width: scene.width,
    height: scene.height,
    transform: scale === 1 ? undefined : `scale(${scale})`,
    transformOrigin: "top left",
  };

  return (
    <div className={className} style={outerStyle} data-alert-scene-stage="">
      <div style={innerStyle}>
        <TintFilterDefs scene={scene} stageId={stageId} />
        {scene.layers.map((layer: Layer) =>
          layer.clips.map((clip: Clip) => (
            <div
              key={clip.id}
              ref={registerClip(clip.id)}
              data-clip-id={clip.id}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                display: "none",
                willChange: "transform, opacity",
                ...effectsStyle(clip.effects, tintFilterId(stageId, clip.id)),
              }}
            >
              <ClipContent clip={clip} tokens={tokens} mediaRef={registerMedia(clip.id)} />
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export type { RenderNode };
