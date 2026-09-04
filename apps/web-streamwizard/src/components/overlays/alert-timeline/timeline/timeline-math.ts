/**
 * Pure maths for the timeline: time <-> pixels, zoom, ruler ticks, snapping
 * and the clamps that keep a drag legal before it ever reaches scene-ops.
 */

import { MIN_CLIP_MS, type AlertScene } from "@repo/alert-scene";
import { WHEEL_NOTCH_PX, WHEEL_ZOOM_STEP } from "@/components/overlays/editor/canvas-zoom";

/** 200 s across 1000 px … 1 ms = 2 px. */
export const PX_PER_MS_MIN = 0.005;
export const PX_PER_MS_MAX = 2;
export const DEFAULT_PX_PER_MS = 0.15;
/** Room after the scene end so the last clip edge is grabbable. */
export const TIMELINE_END_PADDING_PX = 120;
/** Snap radius in screen px. */
export const SNAP_THRESHOLD_PX = 8;

export function msToPx(ms: number, pxPerMs: number): number {
  return ms * pxPerMs;
}

export function pxToMs(px: number, pxPerMs: number): number {
  return pxPerMs > 0 ? px / pxPerMs : 0;
}

export function clampPxPerMs(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_PX_PER_MS;
  return Math.min(PX_PER_MS_MAX, Math.max(PX_PER_MS_MIN, v));
}

/** Same feel as the canvas: one wheel notch is one zoom step, trackpads glide. */
export function wheelZoomPxPerMs(pxPerMs: number, deltaY: number): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return clampPxPerMs(pxPerMs);
  return clampPxPerMs(pxPerMs * Math.pow(WHEEL_ZOOM_STEP, -deltaY / WHEEL_NOTCH_PX));
}

/** The zoom that lays the whole scene across `viewportPx`. */
export function fitPxPerMs(durationMs: number, viewportPx: number, paddingPx = TIMELINE_END_PADDING_PX): number {
  if (durationMs <= 0 || viewportPx <= paddingPx) return DEFAULT_PX_PER_MS;
  return clampPxPerMs((viewportPx - paddingPx) / durationMs);
}

/**
 * New scrollLeft that keeps the time under the cursor in place across a zoom.
 * `cursorPx` is measured from the left edge of the scrolling content (after
 * the header column), not the viewport.
 */
export function zoomAboutTime(scrollLeft: number, pxPerMs: number, nextPxPerMs: number, cursorPx: number): number {
  const timeAtCursor = pxToMs(scrollLeft + cursorPx, pxPerMs);
  return Math.max(0, msToPx(timeAtCursor, nextPxPerMs) - cursorPx);
}

export const TICK_LADDER_MS = [10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10_000, 30_000, 60_000] as const;

/** Smallest ladder step whose labels sit at least `minGapPx` apart. */
export function niceTickMs(pxPerMs: number, minGapPx = 80): number {
  for (const step of TICK_LADDER_MS) {
    if (msToPx(step, pxPerMs) >= minGapPx) return step;
  }
  return TICK_LADDER_MS[TICK_LADDER_MS.length - 1];
}

/** 0, step, 2·step … up to and including the last step ≤ duration. */
export function tickTimes(durationMs: number, stepMs: number): number[] {
  if (stepMs <= 0 || durationMs < 0) return [0];
  const out: number[] = [];
  for (let t = 0; t <= durationMs + 1e-6; t += stepMs) out.push(Math.round(t));
  return out;
}

export function frameMs(fps: number): number {
  return fps > 0 ? 1000 / fps : 1000 / 60;
}

export function snapToFrame(ms: number, fps: number): number {
  const f = frameMs(fps);
  return Math.round(ms / f) * f;
}

export interface SnapResult {
  time: number;
  snapped: boolean;
  /** The candidate it locked to, for drawing a guide. */
  target: number | null;
}

/** Locks `t` to the nearest candidate inside the threshold, else leaves it. */
export function snapTime(t: number, candidates: readonly number[], pxPerMs: number, thresholdPx = SNAP_THRESHOLD_PX): SnapResult {
  let best: number | null = null;
  let bestDist = Infinity;
  const thresholdMs = pxToMs(thresholdPx, pxPerMs);
  for (const c of candidates) {
    const d = Math.abs(c - t);
    if (d <= thresholdMs && d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best === null ? { time: t, snapped: false, target: null } : { time: best, snapped: true, target: best };
}

export interface Neighbours {
  /** End of the clip before this one on the layer, if any. */
  prevEnd: number | null;
  /** Start of the clip after this one on the layer, if any. */
  nextStart: number | null;
}

export function neighboursOf(clips: ReadonlyArray<{ id: string; start: number; end: number }>, clipId: string): Neighbours {
  let prevEnd: number | null = null;
  let nextStart: number | null = null;
  const me = clips.find((c) => c.id === clipId);
  if (!me) return { prevEnd, nextStart };
  for (const c of clips) {
    if (c.id === clipId) continue;
    if (c.end <= me.start) prevEnd = prevEnd === null ? c.end : Math.max(prevEnd, c.end);
    else if (c.start >= me.end) nextStart = nextStart === null ? c.start : Math.min(nextStart, c.start);
  }
  return { prevEnd, nextStart };
}

/** The largest |delta| ≤ the wanted one that keeps the clip off its neighbours and after 0. */
export function clampClipMove(clip: { start: number; end: number }, wanted: number, n: Neighbours): number {
  const len = clip.end - clip.start;
  const minStart = n.prevEnd ?? 0;
  const maxStart = n.nextStart === null ? Infinity : n.nextStart - len;
  const start = Math.min(maxStart, Math.max(minStart, clip.start + wanted));
  return start - clip.start;
}

/** Extra bounds on a trim, from the clip's source footage (see media-math). */
export interface TrimLimits {
  /** Earliest the start edge may go: a media clip has no footage before its source starts. */
  minStart?: number;
  /** Latest the end edge may go: no footage past the source end unless it loops. */
  maxEnd?: number;
}

/**
 * Where the edge may land: never past the other edge minus MIN_CLIP_MS, never
 * into a neighbour, never outside `limits`. The minimum length wins over a
 * source shorter than that.
 */
export function clampClipTrim(
  clip: { start: number; end: number },
  edge: "start" | "end",
  wanted: number,
  n: Neighbours,
  limits: TrimLimits = {}
): number {
  if (edge === "start") {
    const min = Math.max(n.prevEnd ?? 0, limits.minStart ?? -Infinity);
    const max = clip.end - MIN_CLIP_MS;
    return Math.min(max, Math.max(min, wanted));
  }
  const min = clip.start + MIN_CLIP_MS;
  const max = Math.min(n.nextStart ?? Infinity, limits.maxEnd ?? Infinity);
  return Math.max(min, Math.min(max, wanted));
}

export const DEFAULT_CLIP_MS = 3000;

/** New clips land at the playhead, or at the start when the playhead sits at the end. */
export function newClipRange(scene: Pick<AlertScene, "duration">, playhead: number, wantedMs = DEFAULT_CLIP_MS): { start: number; end: number } {
  const start = playhead >= scene.duration - MIN_CLIP_MS ? 0 : Math.max(0, playhead);
  const length = Math.max(MIN_CLIP_MS, Math.round(wantedMs));
  const end = Math.max(start + MIN_CLIP_MS, Math.min(scene.duration, start + length));
  return { start, end };
}

/** Every time worth snapping to while dragging `excludeClipId`. */
export function snapCandidates(
  layers: ReadonlyArray<{ clips: ReadonlyArray<{ id: string; start: number; end: number }> }>,
  opts: { playhead: number; duration: number; excludeClipId?: string; tickMs?: number }
): number[] {
  const out = new Set<number>([0, opts.duration, opts.playhead]);
  for (const layer of layers) {
    for (const c of layer.clips) {
      if (c.id === opts.excludeClipId) continue;
      out.add(c.start);
      out.add(c.end);
    }
  }
  if (opts.tickMs && opts.tickMs > 0) {
    for (let t = 0; t <= opts.duration; t += opts.tickMs) out.add(t);
  }
  return [...out];
}
