/**
 * Undoable edits over an AlertScene. A command captures whatever its inverse
 * needs at construction time, so undo/redo replay deterministically without
 * DOM snapshots. Everything delegates to scene-ops.
 */

import { hasTrack, keyframeTime, valueAt } from "./prop-writer";
import {
  addClip,
  addLayer,
  clearTrack,
  createId,
  findClip,
  findLayer,
  moveClip,
  moveKeyframe,
  moveLayer,
  removeClip,
  removeKeyframe,
  removeLayer,
  setBaseProp,
  setKeyframe,
  setKeyframeEasing,
  setSceneMeta,
  setTrack,
  splitClip,
  trimClip,
  updateClip,
  updateLayer,
  type AlertScene,
  type Clip,
  type Easing,
  type Keyframe,
  type Layer,
  type PropName,
} from "@repo/alert-scene";

export interface Command {
  label: string;
  apply(scene: AlertScene): AlertScene;
  invert(scene: AlertScene): AlertScene;
  /**
   * Same key on two commands within the coalesce window merges them into one
   * undo step. Used for typing in a number field.
   */
  coalesceKey?: string;
}

export function compositeCommand(label: string, commands: Command[]): Command {
  return {
    label,
    apply: (s) => commands.reduce((acc, c) => c.apply(acc), s),
    invert: (s) => [...commands].reverse().reduce((acc, c) => c.invert(acc), s),
  };
}

// ── Scene ───────────────────────────────────────────────────────────────

export function setSceneMetaCommand(
  scene: AlertScene,
  patch: Partial<Pick<AlertScene, "name" | "duration" | "width" | "height" | "fps">>,
  coalesceKey?: string
): Command {
  const prev: typeof patch = {};
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) (prev as Record<string, unknown>)[key] = scene[key];
  return {
    label: "Edit scene",
    apply: (s) => setSceneMeta(s, patch),
    invert: (s) => setSceneMeta(s, prev),
    coalesceKey,
  };
}

// ── Layers ──────────────────────────────────────────────────────────────

export function addLayerCommand(layer: Layer, index?: number): Command {
  return {
    label: `Add ${layer.type} layer`,
    apply: (s) => addLayer(s, layer, index),
    invert: (s) => removeLayer(s, layer.id),
  };
}

export function removeLayerCommand(scene: AlertScene, layerId: string): Command | null {
  const found = findLayer(scene, layerId);
  if (!found) return null;
  const { layer, index } = found;
  return {
    label: "Delete layer",
    apply: (s) => removeLayer(s, layerId),
    invert: (s) => addLayer(s, layer, index),
  };
}

export function moveLayerCommand(scene: AlertScene, layerId: string, toIndex: number): Command | null {
  const found = findLayer(scene, layerId);
  if (!found) return null;
  const fromIndex = found.index;
  return {
    label: "Reorder layers",
    apply: (s) => moveLayer(s, layerId, toIndex),
    invert: (s) => moveLayer(s, layerId, fromIndex),
  };
}

export function updateLayerCommand(
  scene: AlertScene,
  layerId: string,
  patch: Partial<Pick<Layer, "name" | "visible" | "locked" | "muted">>,
  coalesceKey?: string
): Command | null {
  const found = findLayer(scene, layerId);
  if (!found) return null;
  const prev: typeof patch = {};
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) (prev as Record<string, unknown>)[key] = found.layer[key];
  return {
    label: "Edit layer",
    apply: (s) => updateLayer(s, layerId, patch),
    invert: (s) => updateLayer(s, layerId, prev),
    coalesceKey,
  };
}

// ── Clips ───────────────────────────────────────────────────────────────

export function addClipCommand(layerId: string, clip: Clip): Command {
  return {
    label: "Add clip",
    apply: (s) => addClip(s, layerId, clip),
    invert: (s) => removeClip(s, clip.id),
  };
}

export function removeClipCommand(scene: AlertScene, clipId: string): Command | null {
  const loc = findClip(scene, clipId);
  if (!loc) return null;
  const { clip, layer } = loc;
  return {
    label: "Delete clip",
    apply: (s) => removeClip(s, clipId),
    invert: (s) => addClip(s, layer.id, clip),
  };
}

export function moveClipCommand(clipId: string, deltaMs: number): Command {
  return {
    label: "Move clip",
    apply: (s) => moveClip(s, clipId, deltaMs),
    invert: (s) => moveClip(s, clipId, -deltaMs),
  };
}

export function trimClipCommand(scene: AlertScene, clipId: string, edge: "start" | "end", timeMs: number): Command | null {
  const loc = findClip(scene, clipId);
  if (!loc) return null;
  const from = loc.clip[edge];
  const trimIn = loc.clip.trimIn;
  return {
    label: "Trim clip",
    apply: (s) => trimClip(s, clipId, edge, timeMs),
    // trimClip clamps trimIn at 0 on the way in, so restore it explicitly.
    invert: (s) => updateClip(trimClip(s, clipId, edge, from), clipId, { trimIn }),
  };
}

export function updateClipCommand(
  scene: AlertScene,
  clipId: string,
  patch: Partial<Pick<Clip, "source" | "base" | "effects" | "trimIn" | "trimOut">>,
  coalesceKey?: string
): Command | null {
  const loc = findClip(scene, clipId);
  if (!loc) return null;
  const prev: typeof patch = {};
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) (prev as Record<string, unknown>)[key] = loc.clip[key];
  return {
    label: "Edit clip",
    apply: (s) => updateClip(s, clipId, patch),
    invert: (s) => updateClip(s, clipId, prev),
    coalesceKey,
  };
}

export function setBasePropCommand(scene: AlertScene, clipId: string, prop: PropName, value: number, coalesceKey?: string): Command | null {
  const loc = findClip(scene, clipId);
  if (!loc) return null;
  const prev = loc.clip.base[prop];
  return {
    label: `Set ${prop}`,
    apply: (s) => setBaseProp(s, clipId, prop, value),
    invert: (s) => setBaseProp(s, clipId, prop, prev),
    coalesceKey,
  };
}

/** Precomputes the halves so redo yields the same ids as the first apply. */
export function splitClipCommand(scene: AlertScene, clipId: string, atMs: number): Command | null {
  const loc = findClip(scene, clipId);
  if (!loc) return null;
  const res = splitClip(scene, clipId, atMs);
  if (!res) return null;
  const layerId = loc.layer.id;
  const original = loc.clip;
  const left = findClip(res.scene, res.leftId)!.clip;
  const right = findClip(res.scene, res.rightId)!.clip;
  return {
    label: "Split clip",
    apply: (s) => addClip(addClip(removeClip(s, original.id), layerId, left), layerId, right),
    invert: (s) => addClip(removeClip(removeClip(s, left.id), right.id), layerId, original),
  };
}

// ── Keyframes ───────────────────────────────────────────────────────────

export function setKeyframeCommand(
  scene: AlertScene,
  clipId: string,
  prop: PropName,
  keyframe: { time: number; value: number; easing?: Easing },
  coalesceKey?: string
): Command | null {
  const loc = findClip(scene, clipId);
  if (!loc) return null;
  const prior = loc.clip.tracks[prop]?.keyframes.find((k) => k.time === keyframe.time) ?? null;
  const id = prior?.id ?? createId("kf");
  const next: Keyframe = { id, time: keyframe.time, value: keyframe.value, easing: keyframe.easing ?? prior?.easing ?? "linear" };
  return {
    label: prior ? "Change keyframe" : "Add keyframe",
    apply: (s) => setKeyframe(s, clipId, prop, next),
    invert: (s) => (prior ? setKeyframe(s, clipId, prop, prior) : removeKeyframe(s, clipId, prop, id)),
    coalesceKey,
  };
}

export function removeKeyframeCommand(scene: AlertScene, clipId: string, prop: PropName, keyframeId: string): Command | null {
  const loc = findClip(scene, clipId);
  const kf = loc?.clip.tracks[prop]?.keyframes.find((k) => k.id === keyframeId);
  if (!loc || !kf) return null;
  return {
    label: "Delete keyframe",
    apply: (s) => removeKeyframe(s, clipId, prop, keyframeId),
    invert: (s) => setKeyframe(s, clipId, prop, kf),
  };
}

export function moveKeyframeCommand(scene: AlertScene, clipId: string, prop: PropName, keyframeId: string, timeMs: number): Command | null {
  const loc = findClip(scene, clipId);
  const track = loc?.clip.tracks[prop];
  const kf = track?.keyframes.find((k) => k.id === keyframeId);
  if (!loc || !track || !kf) return null;
  const from = kf.time;
  const displaced = track.keyframes.find((k) => k.id !== keyframeId && k.time === timeMs) ?? null;
  return {
    label: "Move keyframe",
    apply: (s) => moveKeyframe(s, clipId, prop, keyframeId, timeMs),
    invert: (s) => {
      const back = moveKeyframe(s, clipId, prop, keyframeId, from);
      return displaced ? setKeyframe(back, clipId, prop, displaced) : back;
    },
  };
}

export function setKeyframeEasingCommand(scene: AlertScene, clipId: string, prop: PropName, keyframeId: string, easing: Easing): Command | null {
  const loc = findClip(scene, clipId);
  const kf = loc?.clip.tracks[prop]?.keyframes.find((k) => k.id === keyframeId);
  if (!loc || !kf) return null;
  const prev = kf.easing;
  return {
    label: "Change easing",
    apply: (s) => setKeyframeEasing(s, clipId, prop, keyframeId, easing),
    invert: (s) => setKeyframeEasing(s, clipId, prop, keyframeId, prev),
  };
}

// ── Tracks and the auto-keyframe rule ───────────────────────────────────

export function clearTrackCommand(scene: AlertScene, clipId: string, prop: PropName): Command | null {
  const loc = findClip(scene, clipId);
  const track = loc?.clip.tracks[prop];
  if (!loc || !track || track.keyframes.length === 0) return null;
  const keyframes = track.keyframes;
  return {
    label: `Stop animating ${prop}`,
    apply: (s) => clearTrack(s, clipId, prop),
    invert: (s) => setTrack(s, clipId, prop, keyframes),
  };
}

/** Replaces every keyframe on a track (easing applied to all, pasted tracks). */
export function setTrackCommand(scene: AlertScene, clipId: string, prop: PropName, keyframes: Keyframe[]): Command | null {
  const loc = findClip(scene, clipId);
  if (!loc) return null;
  const prev = loc.clip.tracks[prop]?.keyframes ?? [];
  return {
    label: `Edit ${prop} keyframes`,
    apply: (s) => setTrack(s, clipId, prop, keyframes),
    invert: (s) => setTrack(s, clipId, prop, prev),
  };
}

/**
 * The auto-keyframe rule as a command: a keyframe at the playhead when the
 * property is animated, a base change when it is not.
 */
export function writePropCommand(
  scene: AlertScene,
  clipId: string,
  prop: PropName,
  value: number,
  timeMs: number,
  coalesceKey?: string
): Command | null {
  const loc = findClip(scene, clipId);
  if (!loc) return null;
  if (hasTrack(loc.clip, prop)) return setKeyframeCommand(scene, clipId, prop, { time: keyframeTime(timeMs), value }, coalesceKey);
  return setBasePropCommand(scene, clipId, prop, value, coalesceKey);
}

/** Several properties at once (a drag that moves x and y) as one undo step. */
export function writePropsCommand(
  scene: AlertScene,
  clipId: string,
  values: Partial<Record<PropName, number>>,
  timeMs: number,
  label = "Edit clip",
  coalesceKey?: string
): Command | null {
  const commands: Command[] = [];
  let working = scene;
  for (const key in values) {
    const prop = key as PropName;
    const value = values[prop];
    if (typeof value !== "number") continue;
    const cmd = writePropCommand(working, clipId, prop, value, timeMs);
    if (!cmd) return null;
    commands.push(cmd);
    working = cmd.apply(working);
  }
  if (commands.length === 0) return null;
  return { ...compositeCommand(label, commands), coalesceKey };
}

export function stopwatchOnCommand(scene: AlertScene, clipId: string, prop: PropName, timeMs: number): Command | null {
  const loc = findClip(scene, clipId);
  if (!loc || hasTrack(loc.clip, prop)) return null;
  const cmd = setKeyframeCommand(scene, clipId, prop, { time: keyframeTime(timeMs), value: loc.clip.base[prop] });
  return cmd ? { ...cmd, label: `Animate ${prop}` } : null;
}

export function stopwatchOffCommand(scene: AlertScene, clipId: string, prop: PropName, timeMs: number): Command | null {
  const loc = findClip(scene, clipId);
  if (!loc || !hasTrack(loc.clip, prop)) return null;
  const clear = clearTrackCommand(scene, clipId, prop);
  const settle = setBasePropCommand(scene, clipId, prop, valueAt(loc.clip, prop, timeMs));
  if (!clear || !settle) return null;
  return compositeCommand(`Stop animating ${prop}`, [clear, settle]);
}

/**
 * Deleting a keyframe. Taking away the last one is the stopwatch going off:
 * the value it held settles into base instead of snapping back to whatever
 * base was before the property was animated.
 */
export function deleteKeyframeCommand(scene: AlertScene, clipId: string, prop: PropName, keyframeId: string, timeMs: number): Command | null {
  const loc = findClip(scene, clipId);
  const track = loc?.clip.tracks[prop];
  if (!loc || !track) return null;
  if (track.keyframes.length === 1 && track.keyframes[0]!.id === keyframeId) return stopwatchOffCommand(scene, clipId, prop, timeMs);
  return removeKeyframeCommand(scene, clipId, prop, keyframeId);
}
