import { easeProgress } from "./easing";
import type {
  AlertScene,
  BaseProps,
  Clip,
  KeyframeTrack,
  Layer,
  PropName,
  RenderNode,
  RenderState,
} from "./types";

/**
 * Value of one property at time `t`.
 *
 * - no track / empty track -> `base`
 * - one keyframe -> its value everywhere
 * - before the first / after the last -> clamped to that keyframe
 * - between two -> the leading keyframe's easing over the segment
 */
export function evaluateTrack(track: KeyframeTrack | undefined, base: number, t: number): number {
  const kfs = track?.keyframes;
  if (!kfs || kfs.length === 0) return base;
  const first = kfs[0]!;
  if (kfs.length === 1 || t <= first.time) return first.value;
  const last = kfs[kfs.length - 1]!;
  if (t >= last.time) return last.value;

  // Binary search for the segment [lo, hi] with lo.time <= t < hi.time.
  let lo = 0;
  let hi = kfs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (kfs[mid]!.time <= t) lo = mid;
    else hi = mid;
  }
  const a = kfs[lo]!;
  const b = kfs[hi]!;
  const span = b.time - a.time;
  if (span <= 0) return b.value;
  const u = (t - a.time) / span;
  return a.value + (b.value - a.value) * easeProgress(u, a.easing);
}

/** Clip active at `t` on this layer, if any. Clips are sorted and disjoint. */
export function activeClipAt(layer: Layer, t: number): Clip | null {
  const clips = layer.clips;
  let lo = 0;
  let hi = clips.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = clips[mid]!;
    if (t < c.start) hi = mid - 1;
    else if (t >= c.end) lo = mid + 1;
    else return c;
  }
  return null;
}

export function evaluateProps(clip: Clip, t: number): BaseProps {
  const out = { ...clip.base };
  for (const prop in clip.tracks) {
    const p = prop as PropName;
    out[p] = evaluateTrack(clip.tracks[p], clip.base[p], t);
  }
  return out;
}

function toNode(layer: Layer, clip: Clip, t: number): RenderNode {
  const props = evaluateProps(clip, t);
  const localTime = t - clip.start;
  return {
    layerId: layer.id,
    clipId: clip.id,
    type: layer.type,
    source: clip.source,
    effects: clip.effects,
    x: props.x,
    y: props.y,
    width: props.width,
    height: props.height,
    scaleX: props.scaleX,
    scaleY: props.scaleY,
    rotation: props.rotation,
    opacity: Math.min(1, Math.max(0, props.opacity)),
    anchorX: props.anchorX,
    anchorY: props.anchorY,
    volume: layer.muted ? 0 : Math.min(1, Math.max(0, props.volume)),
    localTime,
    mediaTime: clip.trimIn + localTime,
    clipDuration: clip.end - clip.start,
  };
}

/**
 * The whole scene at time `t`. Pure: same scene + same t = same output, which
 * is what lets scrubbing, pausing and live playback share one renderer.
 */
export function evaluate(scene: AlertScene, t: number): RenderState {
  const nodes: RenderNode[] = [];
  for (const layer of scene.layers) {
    if (!layer.visible) continue;
    const clip = activeClipAt(layer, t);
    if (clip) nodes.push(toNode(layer, clip, t));
  }
  return { time: t, width: scene.width, height: scene.height, nodes };
}
