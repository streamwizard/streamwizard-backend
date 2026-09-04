import type { Clip, Keyframe, KeyframeTrack, PropName } from "@repo/alert-scene";

const EPS = 0.5;

/** Every keyframe time on the clip, across all tracks, sorted and unique. */
export function keyframeTimesForClip(clip: Clip): number[] {
  const set = new Set<number>();
  for (const key in clip.tracks) {
    const track = clip.tracks[key as PropName];
    for (const k of track?.keyframes ?? []) set.add(k.time);
  }
  return [...set].sort((a, b) => a - b);
}

export function prevKeyframeTime(times: readonly number[], t: number): number | null {
  let best: number | null = null;
  for (const time of times) {
    if (time < t - EPS) best = time;
    else break;
  }
  return best;
}

export function nextKeyframeTime(times: readonly number[], t: number): number | null {
  for (const time of times) if (time > t + EPS) return time;
  return null;
}

/** The keyframe sitting at `t`, within half a millisecond. */
export function keyframeAt(track: KeyframeTrack | undefined, t: number, toleranceMs = EPS): Keyframe | null {
  if (!track) return null;
  return track.keyframes.find((k) => Math.abs(k.time - t) <= toleranceMs) ?? null;
}
