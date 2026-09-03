import { describe, expect, it } from "bun:test";
import { clampBezier, cubicBezier, easeProgress, EASING_PRESETS } from "./easing";

describe("cubicBezier", () => {
  it("pins the ends", () => {
    expect(cubicBezier(EASING_PRESETS.easeInOut, 0)).toBe(0);
    expect(cubicBezier(EASING_PRESETS.easeInOut, 1)).toBe(1);
    expect(cubicBezier(EASING_PRESETS.easeInOut, -0.5)).toBe(0);
    expect(cubicBezier(EASING_PRESETS.easeInOut, 1.5)).toBe(1);
  });

  it("is the identity when both control points sit on the diagonal", () => {
    expect(cubicBezier({ x1: 0.25, y1: 0.25, x2: 0.75, y2: 0.75 }, 0.3)).toBeCloseTo(0.3, 10);
  });

  it("matches the CSS ease-in-out midpoint", () => {
    expect(cubicBezier(EASING_PRESETS.easeInOut, 0.5)).toBeCloseTo(0.5, 4);
    // ease-in is slow to start
    expect(cubicBezier(EASING_PRESETS.easeIn, 0.25)).toBeLessThan(0.15);
    // ease-out is fast to start
    expect(cubicBezier(EASING_PRESETS.easeOut, 0.25)).toBeGreaterThan(0.3);
  });

  it("is monotone for standard curves", () => {
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const y = cubicBezier(EASING_PRESETS.easeOutStrong, i / 100);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = y;
    }
    expect(prev).toBeCloseTo(1, 6);
  });

  it("overshoots when y controls leave [0,1]", () => {
    let max = 0;
    for (let i = 0; i <= 100; i++) max = Math.max(max, cubicBezier(EASING_PRESETS.backOut, i / 100));
    expect(max).toBeGreaterThan(1);
  });

  it("survives a degenerate flat curve without hanging", () => {
    expect(cubicBezier({ x1: 0, y1: 0, x2: 0, y2: 0 }, 0.5)).toBeGreaterThanOrEqual(0);
    expect(cubicBezier({ x1: 1, y1: 1, x2: 1, y2: 1 }, 0.5)).toBeLessThanOrEqual(1);
  });
});

describe("easeProgress", () => {
  it("linear passes through and clamps", () => {
    expect(easeProgress(0.4, "linear")).toBe(0.4);
    expect(easeProgress(-1, "linear")).toBe(0);
    expect(easeProgress(2, "linear")).toBe(1);
  });

  it("hold stays at the leading value until the next keyframe", () => {
    expect(easeProgress(0, "hold")).toBe(0);
    expect(easeProgress(0.999, "hold")).toBe(0);
    expect(easeProgress(1, "hold")).toBe(0);
  });
});

describe("clampBezier", () => {
  it("keeps x in [0,1] and tolerates NaN", () => {
    expect(clampBezier({ x1: -1, y1: 5, x2: 2, y2: Number.NaN })).toEqual({ x1: 0, y1: 3, x2: 1, y2: 0 });
  });
});
