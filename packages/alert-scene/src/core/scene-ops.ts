/**
 * Pure edits over a scene. Every function returns a new scene and leaves the
 * input untouched, sharing every untouched layer/clip by reference so the
 * editor's undo stack and React can compare cheaply.
 *
 * Range-changing ops throw on overlap: the editor clamps first (see
 * timeline-math), so a throw here is a bug, not a user error.
 */

import { evaluateTrack } from "./evaluate";
import { createId } from "./ids";
import { MIN_CLIP_MS } from "./schema";
import type {
  AlertScene,
  Clip,
  Easing,
  Keyframe,
  KeyframeTrack,
  Layer,
  PropName,
} from "./types";

export interface ClipLocation {
  layer: Layer;
  layerIndex: number;
  clip: Clip;
  clipIndex: number;
}

export function findLayer(scene: AlertScene, layerId: string): { layer: Layer; index: number } | null {
  const index = scene.layers.findIndex((l) => l.id === layerId);
  const layer = scene.layers[index];
  return layer ? { layer, index } : null;
}

export function findClip(scene: AlertScene, clipId: string): ClipLocation | null {
  for (let li = 0; li < scene.layers.length; li++) {
    const layer = scene.layers[li]!;
    const ci = layer.clips.findIndex((c) => c.id === clipId);
    if (ci >= 0) return { layer, layerIndex: li, clip: layer.clips[ci]!, clipIndex: ci };
  }
  return null;
}

export function clipDuration(clip: Pick<Clip, "start" | "end">): number {
  return clip.end - clip.start;
}

/** Latest clip end across the scene; 0 when empty. */
export function sceneContentEnd(scene: AlertScene): number {
  let end = 0;
  for (const layer of scene.layers) for (const c of layer.clips) end = Math.max(end, c.end);
  return end;
}

/** True when `[start, end)` fits on the layer without touching another clip. */
export function canPlaceClip(layer: Layer, start: number, end: number, ignoreClipId?: string): boolean {
  if (!(end > start)) return false;
  for (const c of layer.clips) {
    if (c.id === ignoreClipId) continue;
    if (start < c.end && end > c.start) return false;
  }
  return true;
}

function replaceLayer(scene: AlertScene, index: number, layer: Layer): AlertScene {
  const layers = scene.layers.slice();
  layers[index] = layer;
  return { ...scene, layers };
}

function sortedClips(clips: Clip[]): Clip[] {
  return clips.slice().sort((a, b) => a.start - b.start);
}

function replaceClip(scene: AlertScene, loc: ClipLocation, clip: Clip): AlertScene {
  const clips = loc.layer.clips.slice();
  clips[loc.clipIndex] = clip;
  return replaceLayer(scene, loc.layerIndex, { ...loc.layer, clips: sortedClips(clips) });
}

// ── Scene ───────────────────────────────────────────────────────────────

export function setSceneMeta(
  scene: AlertScene,
  patch: Partial<Pick<AlertScene, "name" | "duration" | "width" | "height" | "fps">>
): AlertScene {
  return { ...scene, ...patch };
}

// ── Layers ──────────────────────────────────────────────────────────────

/** Inserts at `index` (default: on top). */
export function addLayer(scene: AlertScene, layer: Layer, index = scene.layers.length): AlertScene {
  const layers = scene.layers.slice();
  layers.splice(Math.min(Math.max(0, index), layers.length), 0, layer);
  return { ...scene, layers };
}

export function removeLayer(scene: AlertScene, layerId: string): AlertScene {
  return { ...scene, layers: scene.layers.filter((l) => l.id !== layerId) };
}

export function moveLayer(scene: AlertScene, layerId: string, toIndex: number): AlertScene {
  const found = findLayer(scene, layerId);
  if (!found) return scene;
  const layers = scene.layers.slice();
  layers.splice(found.index, 1);
  layers.splice(Math.min(Math.max(0, toIndex), layers.length), 0, found.layer);
  return { ...scene, layers };
}

export function updateLayer(
  scene: AlertScene,
  layerId: string,
  patch: Partial<Pick<Layer, "name" | "visible" | "locked" | "muted">>
): AlertScene {
  const found = findLayer(scene, layerId);
  if (!found) return scene;
  return replaceLayer(scene, found.index, { ...found.layer, ...patch });
}

// ── Clips ───────────────────────────────────────────────────────────────

export function addClip(scene: AlertScene, layerId: string, clip: Clip): AlertScene {
  const found = findLayer(scene, layerId);
  if (!found) throw new Error(`addClip: no layer ${layerId}`);
  if (clip.source.kind !== found.layer.type) {
    throw new Error(`addClip: ${clip.source.kind} clip on a ${found.layer.type} layer`);
  }
  if (!canPlaceClip(found.layer, clip.start, clip.end)) throw new Error("addClip: overlaps another clip");
  return replaceLayer(scene, found.index, {
    ...found.layer,
    clips: sortedClips([...found.layer.clips, clip]),
  });
}

export function removeClip(scene: AlertScene, clipId: string): AlertScene {
  const loc = findClip(scene, clipId);
  if (!loc) return scene;
  return replaceLayer(scene, loc.layerIndex, {
    ...loc.layer,
    clips: loc.layer.clips.filter((c) => c.id !== clipId),
  });
}

/** Patches anything that does not move the clip in time (source, base, effects, trims). */
export function updateClip(
  scene: AlertScene,
  clipId: string,
  patch: Partial<Pick<Clip, "source" | "base" | "effects" | "trimIn" | "trimOut">>
): AlertScene {
  const loc = findClip(scene, clipId);
  if (!loc) return scene;
  return replaceClip(scene, loc, { ...loc.clip, ...patch });
}

export function setBaseProp(scene: AlertScene, clipId: string, prop: PropName, value: number): AlertScene {
  const loc = findClip(scene, clipId);
  if (!loc) return scene;
  return replaceClip(scene, loc, { ...loc.clip, base: { ...loc.clip.base, [prop]: value } });
}

function shiftTracks(tracks: Clip["tracks"], delta: number): Clip["tracks"] {
  if (delta === 0) return tracks;
  const out: Clip["tracks"] = {};
  for (const key in tracks) {
    const track = tracks[key as PropName];
    if (!track) continue;
    out[track.property] = {
      property: track.property,
      keyframes: track.keyframes.map((k) => ({ ...k, time: k.time + delta })),
    };
  }
  return out;
}

/** Slides the clip and its keyframes by `deltaMs`. */
export function moveClip(scene: AlertScene, clipId: string, deltaMs: number): AlertScene {
  if (deltaMs === 0) return scene;
  const loc = findClip(scene, clipId);
  if (!loc) return scene;
  const start = loc.clip.start + deltaMs;
  const end = loc.clip.end + deltaMs;
  if (start < 0) throw new Error("moveClip: before scene start");
  if (!canPlaceClip(loc.layer, start, end, clipId)) throw new Error("moveClip: overlaps another clip");
  return replaceClip(scene, loc, { ...loc.clip, start, end, tracks: shiftTracks(loc.clip.tracks, deltaMs) });
}

/**
 * Moves one edge. Keyframes stay where they are. Trimming the start of a
 * media clip shifts `trimIn` the same amount so the footage does not slide.
 */
export function trimClip(scene: AlertScene, clipId: string, edge: "start" | "end", timeMs: number): AlertScene {
  const loc = findClip(scene, clipId);
  if (!loc) return scene;
  const { clip } = loc;
  const isMedia = clip.source.kind === "video" || clip.source.kind === "audio";
  let next: Clip;
  if (edge === "start") {
    const start = Math.max(0, timeMs);
    if (clip.end - start < MIN_CLIP_MS) throw new Error("trimClip: too short");
    const delta = start - clip.start;
    const trimIn = isMedia ? Math.max(0, clip.trimIn + delta) : clip.trimIn;
    next = { ...clip, start, trimIn };
  } else {
    const end = timeMs;
    if (end - clip.start < MIN_CLIP_MS) throw new Error("trimClip: too short");
    next = { ...clip, end };
  }
  if (!canPlaceClip(loc.layer, next.start, next.end, clipId)) throw new Error("trimClip: overlaps another clip");
  return replaceClip(scene, loc, next);
}

export interface SplitResult {
  scene: AlertScene;
  leftId: string;
  rightId: string;
}

/**
 * Cuts a clip at `atMs` into two. Where a track has keyframes on both sides
 * the evaluated value at the cut is pinned on each half, so the motion is
 * unchanged. Returns null when the cut is outside the clip or leaves a sliver.
 */
export function splitClip(scene: AlertScene, clipId: string, atMs: number): SplitResult | null {
  const loc = findClip(scene, clipId);
  if (!loc) return null;
  const { clip } = loc;
  if (atMs - clip.start < MIN_CLIP_MS || clip.end - atMs < MIN_CLIP_MS) return null;

  const leftTracks: Clip["tracks"] = {};
  const rightTracks: Clip["tracks"] = {};
  for (const key in clip.tracks) {
    const track = clip.tracks[key as PropName];
    if (!track || track.keyframes.length === 0) continue;
    const left = track.keyframes.filter((k) => k.time < atMs);
    const right = track.keyframes.filter((k) => k.time >= atMs);
    const hasBoth = left.length > 0 && right.length > 0;
    const exactAtCut = right[0]?.time === atMs;
    if (hasBoth && !exactAtCut) {
      const value = evaluateTrack(track, clip.base[track.property], atMs);
      const leading = left[left.length - 1]!;
      left.push({ id: createId("kf"), time: atMs, value, easing: leading.easing });
      right.unshift({ id: createId("kf"), time: atMs, value, easing: leading.easing });
    }
    if (left.length > 0) leftTracks[track.property] = { property: track.property, keyframes: left };
    if (right.length > 0) {
      rightTracks[track.property] = {
        property: track.property,
        keyframes: right.map((k) => ({ ...k, id: createId("kf") })),
      };
    }
  }

  const isMedia = clip.source.kind === "video" || clip.source.kind === "audio";
  const leftClip: Clip = { ...clip, end: atMs, tracks: leftTracks };
  const rightClip: Clip = {
    ...clip,
    id: createId("clip"),
    start: atMs,
    trimIn: isMedia ? clip.trimIn + (atMs - clip.start) : clip.trimIn,
    tracks: rightTracks,
  };
  const clips = loc.layer.clips.slice();
  clips.splice(loc.clipIndex, 1, leftClip, rightClip);
  return {
    scene: replaceLayer(scene, loc.layerIndex, { ...loc.layer, clips: sortedClips(clips) }),
    leftId: leftClip.id,
    rightId: rightClip.id,
  };
}

// ── Keyframes ───────────────────────────────────────────────────────────

function withTrack(clip: Clip, prop: PropName, keyframes: Keyframe[]): Clip {
  const tracks: Clip["tracks"] = { ...clip.tracks };
  if (keyframes.length === 0) delete tracks[prop];
  else tracks[prop] = { property: prop, keyframes: keyframes.slice().sort((a, b) => a.time - b.time) };
  return { ...clip, tracks };
}

/** Adds a keyframe, or replaces the one already sitting at that exact ms. */
export function setKeyframe(
  scene: AlertScene,
  clipId: string,
  prop: PropName,
  keyframe: { time: number; value: number; easing?: Easing; id?: string }
): AlertScene {
  const loc = findClip(scene, clipId);
  if (!loc) return scene;
  const existing: KeyframeTrack | undefined = loc.clip.tracks[prop];
  const others = (existing?.keyframes ?? []).filter((k) => k.time !== keyframe.time);
  const prior = existing?.keyframes.find((k) => k.time === keyframe.time);
  const next: Keyframe = {
    id: keyframe.id ?? prior?.id ?? createId("kf"),
    time: keyframe.time,
    value: keyframe.value,
    easing: keyframe.easing ?? prior?.easing ?? "linear",
  };
  return replaceClip(scene, loc, withTrack(loc.clip, prop, [...others, next]));
}

export function removeKeyframe(scene: AlertScene, clipId: string, prop: PropName, keyframeId: string): AlertScene {
  const loc = findClip(scene, clipId);
  if (!loc) return scene;
  const track = loc.clip.tracks[prop];
  if (!track) return scene;
  return replaceClip(scene, loc, withTrack(loc.clip, prop, track.keyframes.filter((k) => k.id !== keyframeId)));
}

/** Re-times a keyframe. Landing on another keyframe's time replaces it. */
export function moveKeyframe(
  scene: AlertScene,
  clipId: string,
  prop: PropName,
  keyframeId: string,
  timeMs: number
): AlertScene {
  const loc = findClip(scene, clipId);
  if (!loc) return scene;
  const track = loc.clip.tracks[prop];
  const target = track?.keyframes.find((k) => k.id === keyframeId);
  if (!track || !target) return scene;
  const rest = track.keyframes.filter((k) => k.id !== keyframeId && k.time !== timeMs);
  return replaceClip(scene, loc, withTrack(loc.clip, prop, [...rest, { ...target, time: timeMs }]));
}

export function setKeyframeEasing(
  scene: AlertScene,
  clipId: string,
  prop: PropName,
  keyframeId: string,
  easing: Easing
): AlertScene {
  const loc = findClip(scene, clipId);
  if (!loc) return scene;
  const track = loc.clip.tracks[prop];
  if (!track) return scene;
  return replaceClip(
    scene,
    loc,
    withTrack(
      loc.clip,
      prop,
      track.keyframes.map((k) => (k.id === keyframeId ? { ...k, easing } : k))
    )
  );
}

/** Replaces a whole track. Later entries win on duplicate times; empty removes the track. */
export function setTrack(scene: AlertScene, clipId: string, prop: PropName, keyframes: Keyframe[]): AlertScene {
  const loc = findClip(scene, clipId);
  if (!loc) return scene;
  const byTime = new Map<number, Keyframe>();
  for (const k of keyframes) byTime.set(k.time, k);
  return replaceClip(scene, loc, withTrack(loc.clip, prop, [...byTime.values()]));
}

/** Removes the whole track so the property falls back to `base`. */
export function clearTrack(scene: AlertScene, clipId: string, prop: PropName): AlertScene {
  const loc = findClip(scene, clipId);
  if (!loc || !loc.clip.tracks[prop]) return scene;
  return replaceClip(scene, loc, withTrack(loc.clip, prop, []));
}

/** Distinct font families used by text clips, for whoever loads web fonts. */
export function collectSceneFontFamilies(scene: AlertScene): string[] {
  const out = new Set<string>();
  for (const layer of scene.layers) {
    for (const clip of layer.clips) {
      if (clip.source.kind === "text" && clip.source.fontFamily.trim()) out.add(clip.source.fontFamily.trim());
    }
  }
  return [...out];
}
