import { describe, expect, it } from "bun:test";
import {
  clampClipMove,
  clampClipTrim,
  clampPxPerMs,
  fitPxPerMs,
  neighboursOf,
  newClipRange,
  niceTickMs,
  PX_PER_MS_MAX,
  PX_PER_MS_MIN,
  snapCandidates,
  snapTime,
  snapToFrame,
  tickTimes,
  wheelZoomPxPerMs,
  zoomAboutTime,
} from "./timeline-math";

describe("zoom", () => {
  it("clamps to the bounds and treats NaN as default", () => {
    expect(clampPxPerMs(100)).toBe(PX_PER_MS_MAX);
    expect(clampPxPerMs(0)).toBe(PX_PER_MS_MIN);
    expect(clampPxPerMs(Number.NaN)).toBe(0.15);
  });

  it("wheel up zooms in, wheel down zooms out", () => {
    expect(wheelZoomPxPerMs(0.1, -100)).toBeGreaterThan(0.1);
    expect(wheelZoomPxPerMs(0.1, 100)).toBeLessThan(0.1);
    expect(wheelZoomPxPerMs(0.1, 0)).toBe(0.1);
  });

  it("fits a scene into the viewport minus padding", () => {
    expect(fitPxPerMs(5000, 1120)).toBe(0.2);
    expect(fitPxPerMs(0, 1000)).toBe(0.15);
  });

  it("keeps the time under the cursor fixed", () => {
    // cursor at 300px with scroll 100 and 0.1 px/ms -> time 4000ms
    const next = zoomAboutTime(100, 0.1, 0.2, 300);
    expect(next).toBe(4000 * 0.2 - 300);
    expect(zoomAboutTime(0, 0.1, 0.05, 50)).toBe(0); // never negative
  });
});

describe("ruler", () => {
  it("picks the first ladder step wide enough", () => {
    expect(niceTickMs(1, 80)).toBe(100);
    expect(niceTickMs(0.1, 80)).toBe(1000);
    expect(niceTickMs(0.0001, 80)).toBe(60_000);
  });

  it("ticks include zero and the last step under the duration", () => {
    expect(tickTimes(1000, 250)).toEqual([0, 250, 500, 750, 1000]);
    expect(tickTimes(1100, 500)).toEqual([0, 500, 1000]);
    expect(tickTimes(1000, 0)).toEqual([0]);
  });

  it("snaps to frames", () => {
    expect(snapToFrame(40, 60)).toBeCloseTo(33.333, 2);
    expect(snapToFrame(0, 60)).toBe(0);
  });
});

describe("snapTime", () => {
  it("locks inside the px threshold and picks the nearest", () => {
    // 8px at 0.1 px/ms = 80ms
    expect(snapTime(1050, [1000, 1100], 0.1)).toEqual({ time: 1000, snapped: true, target: 1000 });
    expect(snapTime(1070, [1000, 1100], 0.1)).toEqual({ time: 1100, snapped: true, target: 1100 });
    expect(snapTime(1500, [1000, 1100], 0.1)).toEqual({ time: 1500, snapped: false, target: null });
  });
});

describe("neighbours and clamps", () => {
  const clips = [
    { id: "a", start: 0, end: 1000 },
    { id: "b", start: 2000, end: 3000 },
    { id: "c", start: 5000, end: 6000 },
  ];

  it("finds the closest clip on each side", () => {
    expect(neighboursOf(clips, "b")).toEqual({ prevEnd: 1000, nextStart: 5000 });
    expect(neighboursOf(clips, "a")).toEqual({ prevEnd: null, nextStart: 2000 });
    expect(neighboursOf(clips, "c")).toEqual({ prevEnd: 3000, nextStart: null });
    expect(neighboursOf(clips, "zzz")).toEqual({ prevEnd: null, nextStart: null });
  });

  it("clampClipMove stops at neighbours and at zero", () => {
    const b = clips[1]!;
    const n = neighboursOf(clips, "b");
    expect(clampClipMove(b, -500, n)).toBe(-500);
    expect(clampClipMove(b, -5000, n)).toBe(-1000);
    expect(clampClipMove(b, 5000, n)).toBe(2000);
    expect(clampClipMove(clips[0]!, -50, neighboursOf(clips, "a"))).toBe(0);
  });

  it("clampClipTrim respects the minimum length and the neighbours", () => {
    const b = clips[1]!;
    const n = neighboursOf(clips, "b");
    expect(clampClipTrim(b, "start", 500, n)).toBe(1000);
    expect(clampClipTrim(b, "start", 2990, n)).toBe(2950);
    expect(clampClipTrim(b, "end", 9000, n)).toBe(5000);
    expect(clampClipTrim(b, "end", 2010, n)).toBe(2050);
  });

  it("clampClipTrim honours footage limits without yanking an edge or going under the minimum", () => {
    const b = clips[1]!;
    const n = neighboursOf(clips, "b");
    expect(clampClipTrim(b, "start", 500, n, { minStart: 1500 })).toBe(1500);
    expect(clampClipTrim(b, "start", 1600, n, { minStart: 1500 })).toBe(1600);
    expect(clampClipTrim(b, "end", 9000, n, { maxEnd: 4000 })).toBe(4000);
    expect(clampClipTrim(b, "end", 3500, n, { maxEnd: 4000 })).toBe(3500);
    // A source shorter than the minimum clip length never produces a sliver.
    expect(clampClipTrim(b, "end", 9000, n, { maxEnd: 2010 })).toBe(2050);
    expect(clampClipTrim(b, "end", 9000, n, {})).toBe(5000);
  });

  it("newClipRange lands at the playhead, wraps at the end and honours a wanted length", () => {
    const scene = { duration: 5000 };
    expect(newClipRange(scene, 1000)).toEqual({ start: 1000, end: 4000 });
    expect(newClipRange(scene, 4000)).toEqual({ start: 4000, end: 5000 });
    expect(newClipRange(scene, 4990)).toEqual({ start: 0, end: 3000 });
    expect(newClipRange(scene, 1000, 1234.6)).toEqual({ start: 1000, end: 2235 });
    expect(newClipRange(scene, 1000, 10)).toEqual({ start: 1000, end: 1050 });
    expect(newClipRange(scene, 1000, 60_000)).toEqual({ start: 1000, end: 5000 });
  });

  it("snapCandidates gathers edges, ends, playhead and ticks minus the dragged clip", () => {
    const c = snapCandidates([{ clips }], { playhead: 4200, duration: 8000, excludeClipId: "b", tickMs: 4000 });
    expect(c).toContain(0);
    expect(c).toContain(8000);
    expect(c).toContain(4200);
    expect(c).toContain(1000);
    expect(c).toContain(5000);
    expect(c).toContain(4000);
    expect(c).not.toContain(2000);
    expect(c).not.toContain(3000);
  });
});
