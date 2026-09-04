/**
 * Seeds a timeline from a legacy alert variant so "Create timeline" opens on
 * something that already looks like the streamer's alert, not a blank stage:
 * the picture or video, both text lines with a plain fade, and the sound.
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
  type FontWeight,
} from "@repo/alert-scene";
import type { AlertVariantConfig } from "@repo/ui/overlay";

/** Mirrors the legacy renderer's in/out timing so the seed feels familiar. */
export const SEED_IN_MS = 500;
export const SEED_OUT_MS = 350;

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

function fade(scene: AlertScene, clipId: string): AlertScene {
  const end = scene.duration;
  let s = setKeyframe(scene, clipId, "opacity", { time: 0, value: 0, easing: { x1: 0.22, y1: 1, x2: 0.36, y2: 1 } });
  s = setKeyframe(s, clipId, "opacity", { time: SEED_IN_MS, value: 1, easing: "linear" });
  s = setKeyframe(s, clipId, "opacity", { time: Math.max(SEED_IN_MS, end - SEED_OUT_MS), value: 1, easing: { x1: 0.42, y1: 0, x2: 1, y2: 1 } });
  s = setKeyframe(s, clipId, "opacity", { time: end, value: 0, easing: "linear" });
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
    scene = fade(addClip(scene, layer.id, clip), clip.id);
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
    scene = fade(addClip(scene, layer.id, clip), clip.id);
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
  scene = fade(addClip(scene, title.id, titleClip), titleClip.id);

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
    scene = fade(addClip(scene, message.id, messageClip), messageClip.id);
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
