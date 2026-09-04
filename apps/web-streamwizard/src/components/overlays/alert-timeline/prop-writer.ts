/**
 * The auto-keyframe rule, in one place. A property that has a track gets a
 * keyframe at the playhead when edited; one that does not just changes its
 * base value. Every editor surface (inspector, stage drags) writes through
 * here so they cannot disagree.
 */

import {
  clearTrack,
  evaluateTrack,
  findClip,
  setBaseProp,
  setKeyframe,
  type AlertScene,
  type Clip,
  type PropName,
} from "@repo/alert-scene";

export function hasTrack(clip: Clip, prop: PropName): boolean {
  return (clip.tracks[prop]?.keyframes.length ?? 0) > 0;
}

/** What the property is worth at `timeMs`: the track if there is one, else base. */
export function valueAt(clip: Clip, prop: PropName, timeMs: number): number {
  return evaluateTrack(clip.tracks[prop], clip.base[prop], timeMs);
}

/** Keyframes live on whole milliseconds so "at the playhead" is a stable key. */
export function keyframeTime(timeMs: number): number {
  return Math.round(timeMs);
}

export function writeProp(scene: AlertScene, clipId: string, prop: PropName, value: number, timeMs: number): AlertScene {
  const loc = findClip(scene, clipId);
  if (!loc) return scene;
  if (hasTrack(loc.clip, prop)) return setKeyframe(scene, clipId, prop, { time: keyframeTime(timeMs), value });
  return setBaseProp(scene, clipId, prop, value);
}

export function writeProps(
  scene: AlertScene,
  clipId: string,
  values: Partial<Record<PropName, number>>,
  timeMs: number
): AlertScene {
  let next = scene;
  for (const key in values) {
    const prop = key as PropName;
    const value = values[prop];
    if (typeof value === "number") next = writeProp(next, clipId, prop, value, timeMs);
  }
  return next;
}

/** Stopwatch on: the first keyframe holds the current value where the playhead sits. */
export function stopwatchOn(scene: AlertScene, clipId: string, prop: PropName, timeMs: number): AlertScene {
  const loc = findClip(scene, clipId);
  if (!loc || hasTrack(loc.clip, prop)) return scene;
  return setKeyframe(scene, clipId, prop, { time: keyframeTime(timeMs), value: loc.clip.base[prop] });
}

/** Stopwatch off: the track goes, and base takes the value that was showing at the playhead. */
export function stopwatchOff(scene: AlertScene, clipId: string, prop: PropName, timeMs: number): AlertScene {
  const loc = findClip(scene, clipId);
  if (!loc || !hasTrack(loc.clip, prop)) return scene;
  const value = valueAt(loc.clip, prop, timeMs);
  return setBaseProp(clearTrack(scene, clipId, prop), clipId, prop, value);
}
