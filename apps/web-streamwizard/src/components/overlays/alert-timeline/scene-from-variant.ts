/**
 * Seeds a timeline from a legacy alert variant so "Create timeline" opens on
 * something that already looks like the streamer's alert, not a blank stage:
 * the picture or video, both text lines and the sound, with the variant's
 * entrance and exit animations written out as keyframes.
 */

import {
  addClip,
  addLayer,
  createClip,
  createEmptyScene,
  createLayer,
  MAX_SCENE_DURATION_MS,
  setKeyframe,
  type AlertScene,
  type BaseProps,
  type ClipSource,
  type Easing,
  type FontWeight,
  type PropName,
} from "@repo/alert-scene";
import type { AlertAnimationIn, AlertAnimationOut, AlertVariantConfig } from "@repo/ui/overlay";

/** Mirrors the legacy renderer's in/out timing so the seed feels familiar. */
export const SEED_IN_MS = 500;
export const SEED_OUT_MS = 350;
/** The legacy CSS: `cubic-bezier(0.22, 1, 0.36, 1)` in, `ease-in` out. Applied per segment, as CSS keyframes do. */
export const SEED_IN_EASING: Easing = { x1: 0.22, y1: 1, x2: 0.36, y2: 1 };
export const SEED_OUT_EASING: Easing = { x1: 0.42, y1: 0, x2: 1, y2: 1 };

interface SeedKeyframe {
  time: number;
  value: number;
  easing?: Easing;
}

type SeedTracks = Partial<Record<PropName, SeedKeyframe[]>>;

/**
 * The legacy `animationIn` as keyframes over the first `SEED_IN_MS`. Slide
 * offsets add to the clip's resting `y` (positions are anchor positions in
 * scene px); scale runs on both axes. Percentages in the CSS bounce become
 * absolute ms inside the in-window.
 */
export function entranceKeyframes(animation: AlertAnimationIn, rest: { y: number }): SeedTracks {
  const e = SEED_IN_EASING;
  const t = SEED_IN_MS;
  const fade: SeedKeyframe[] = [
    { time: 0, value: 0, easing: e },
    { time: t, value: 1 },
  ];
  switch (animation) {
    case "fade":
      return { opacity: fade };
    case "slide_up":
      return { opacity: fade, y: [{ time: 0, value: rest.y + 32, easing: e }, { time: t, value: rest.y }] };
    case "slide_down":
      return { opacity: fade, y: [{ time: 0, value: rest.y - 32, easing: e }, { time: t, value: rest.y }] };
    case "zoom": {
      const scale: SeedKeyframe[] = [{ time: 0, value: 0.8, easing: e }, { time: t, value: 1 }];
      return { opacity: fade, scaleX: scale, scaleY: scale };
    }
    case "bounce": {
      const scale: SeedKeyframe[] = [
        { time: 0, value: 0.6, easing: e },
        { time: Math.round(t * 0.6), value: 1.08, easing: e },
        { time: Math.round(t * 0.8), value: 0.97, easing: e },
        { time: t, value: 1 },
      ];
      return {
        opacity: [{ time: 0, value: 0, easing: e }, { time: Math.round(t * 0.6), value: 1 }],
        scaleX: scale,
        scaleY: scale,
      };
    }
  }
}

/** The legacy `animationOut` as keyframes over the last `SEED_OUT_MS` before `end`. */
export function exitKeyframes(animation: AlertAnimationOut, rest: { y: number }, end: number): SeedTracks {
  const e = SEED_OUT_EASING;
  const start = Math.max(SEED_IN_MS, end - SEED_OUT_MS);
  const fade: SeedKeyframe[] = [
    { time: start, value: 1, easing: e },
    { time: end, value: 0 },
  ];
  switch (animation) {
    case "fade":
      return { opacity: fade };
    case "slide_down":
      return { opacity: fade, y: [{ time: start, value: rest.y, easing: e }, { time: end, value: rest.y + 24 }] };
    case "zoom": {
      const scale: SeedKeyframe[] = [{ time: start, value: 1, easing: e }, { time: end, value: 0.85 }];
      return { opacity: fade, scaleX: scale, scaleY: scale };
    }
  }
}

export interface SeedOptions {
  width: number;
  height: number;
  name: string;
  /**
   * Length of the variant's video, probed by the caller. Only read for a
   * "play the whole video" alert; unknown falls back to the fixed length.
   */
  mediaDurationMs?: number | null;
}

function base(scene: AlertScene, x: number, y: number, width: number, height: number, volume = 1): BaseProps {
  return { x, y, width, height, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, anchorX: 0.5, anchorY: 0.5, volume };
}

function seedDuration(variant: AlertVariantConfig, hasVideo: boolean, mediaDurationMs: number | null | undefined): number {
  const fixed = Math.max(1000, SEED_IN_MS + Math.round(variant.durationSeconds * 1000) + SEED_OUT_MS);
  if (!hasVideo || variant.durationMode !== "media" || !mediaDurationMs || mediaDurationMs <= 0) return fixed;
  return Math.min(MAX_SCENE_DURATION_MS, Math.max(1000, Math.round(mediaDurationMs) + SEED_OUT_MS));
}

/**
 * Writes the variant's entrance and exit onto a visual clip that spans the
 * whole scene. A track both touch rests between them (the in's last and the
 * out's first keyframe hold the same value); a track only one touches holds
 * by `evaluate`'s clamping past its last keyframe.
 */
function animate(scene: AlertScene, clipId: string, rest: BaseProps, variant: AlertVariantConfig): AlertScene {
  const parts = [entranceKeyframes(variant.animationIn, rest), exitKeyframes(variant.animationOut, rest, scene.duration)];
  let s = scene;
  for (const tracks of parts) {
    for (const key in tracks) {
      const prop = key as PropName;
      for (const kf of tracks[prop] ?? []) s = setKeyframe(s, clipId, prop, { time: kf.time, value: kf.value, easing: kf.easing ?? "linear" });
    }
  }
  return s;
}

function textSource(text: string, variant: AlertVariantConfig, size: number, weight: FontWeight, color: string): ClipSource {
  return {
    kind: "text",
    text,
    fontFamily: variant.fontFamily,
    fontSize: size,
    fontWeight: weight,
    color,
    align: variant.align,
    lineHeight: 1.2,
    letterSpacing: 0,
    shadow: variant.textShadow,
    preset: "none",
    presetDurationMs: 800,
    presetOut: "none",
    presetOutDurationMs: 800,
  };
}

export function createTimelineFromVariant(variant: AlertVariantConfig, opts: SeedOptions): AlertScene {
  const hasImage = variant.mediaKind === "image" && Boolean(variant.mediaUrl);
  const hasVideo = variant.mediaKind === "video" && Boolean(variant.mediaUrl);
  const hasSound = Boolean(variant.soundUrl);
  const hasMessage = variant.messageTemplate.trim().length > 0;
  const duration = seedDuration(variant, hasVideo, opts.mediaDurationMs);
  let scene = createEmptyScene({ width: opts.width, height: opts.height, duration, name: opts.name });
  const { width: w, height: h } = scene;

  if (hasImage) {
    const layer = createLayer("image", "Image");
    scene = addLayer(scene, layer);
    const size = Math.round(Math.min(h * 0.55, w * 0.8));
    const clip = createClip({
      start: 0,
      end: duration,
      source: { kind: "image", url: variant.mediaUrl, fit: "contain" },
      base: base(scene, w / 2, Math.round(h * 0.34), size, size),
    });
    scene = animate(addClip(scene, layer.id, clip), clip.id, clip.base, variant);
  }

  if (hasVideo) {
    const layer = createLayer("video", "Video");
    scene = addLayer(scene, layer);
    const clip = createClip({
      start: 0,
      end: duration,
      // The legacy box loops a fixed-length alert's video and lets a
      // video-length alert play through once; a separate sound file mutes it.
      source: { kind: "video", url: variant.mediaUrl, loop: variant.durationMode !== "media", fit: "contain" },
      base: base(scene, w / 2, Math.round(h * 0.34), Math.round(w * 0.8), Math.round(h * 0.55), hasSound ? 0 : 1),
    });
    scene = animate(addClip(scene, layer.id, clip), clip.id, clip.base, variant);
  }

  const hasPicture = hasImage || hasVideo;
  const titleY = hasPicture ? h * 0.74 : hasMessage ? h * 0.44 : h * 0.5;
  const titleH = Math.round(variant.fontSize * 1.5);
  const title = createLayer("text", "Title");
  scene = addLayer(scene, title);
  const titleClip = createClip({
    start: 0,
    end: duration,
    source: textSource(variant.titleTemplate, variant, variant.fontSize, variant.fontWeight, variant.titleColor),
    base: base(scene, w / 2, Math.round(titleY), Math.round(w * 0.9), titleH),
  });
  scene = animate(addClip(scene, title.id, titleClip), titleClip.id, titleClip.base, variant);

  if (hasMessage) {
    const messageSize = Math.round(variant.fontSize * 0.6);
    const message = createLayer("text", "Message");
    scene = addLayer(scene, message);
    const messageClip = createClip({
      start: 0,
      end: duration,
      source: textSource(variant.messageTemplate, variant, messageSize, 400, variant.messageColor),
      base: base(scene, w / 2, Math.round(titleY + titleH / 2 + messageSize * 1.1), Math.round(w * 0.9), Math.round(messageSize * 2.6)),
    });
    scene = animate(addClip(scene, message.id, messageClip), messageClip.id, messageClip.base, variant);
  }

  if (hasSound) {
    // Full volume here: the alert box's own volume slider scales the whole scene.
    const sound = createLayer("audio", "Sound");
    scene = addLayer(scene, sound);
    const soundClip = createClip({
      start: 0,
      end: duration,
      source: { kind: "audio", url: variant.soundUrl },
      base: base(scene, w / 2, h / 2, 0, 0),
    });
    scene = addClip(scene, sound.id, soundClip);
  }

  return scene;
}
