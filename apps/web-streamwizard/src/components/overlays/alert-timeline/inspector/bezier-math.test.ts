import { describe, expect, it } from "bun:test";
import { EASING_PRESETS, type EasingPresetName } from "@repo/alert-scene";
import { BEZIER_VIEW, asBezier, curvePath, curveToSvg, dragHandle, easingForPreset, handlePoints, presetForEasing, svgToCurve } from "./bezier-math";

describe("presets", () => {
  it("recognises every preset and calls anything else custom", () => {
    for (const name in EASING_PRESETS) {
      const preset = EASING_PRESETS[name as EasingPresetName];
      expect(presetForEasing(typeof preset === "object" ? { ...preset } : preset)).toBe(name as EasingPresetName);
    }
    expect(presetForEasing({ x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 })).toBe("custom");
  });

  it("easingForPreset copies beziers and keeps a custom curve", () => {
    const out = easingForPreset("easeOut", "linear");
    expect(out).toEqual(EASING_PRESETS.easeOut);
    expect(out).not.toBe(EASING_PRESETS.easeOut);
    expect(easingForPreset("hold", "linear")).toBe("hold");
    const custom = { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 };
    expect(easingForPreset("custom", custom)).toBe(custom);
    expect(easingForPreset("custom", "linear")).toEqual(EASING_PRESETS.easeOut);
  });

  it("asBezier draws linear as the diagonal and nothing for hold", () => {
    expect(asBezier("linear")).toEqual({ x1: 0, y1: 0, x2: 1, y2: 1 });
    expect(asBezier("hold")).toBeNull();
    expect(asBezier(EASING_PRESETS.backOut)).toBe(EASING_PRESETS.backOut);
  });
});

describe("picture mapping", () => {
  it("round-trips curve and svg space", () => {
    for (const p of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0.34, y: 1.56 }, { x: 0.5, y: -0.25 }]) {
      const back = svgToCurve(curveToSvg(p));
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.y).toBeCloseTo(p.y, 9);
    }
  });

  it("keeps the unit square inside the picture", () => {
    const { start, end } = handlePoints({ x1: 0, y1: 0, x2: 1, y2: 1 });
    expect(start.x).toBe(BEZIER_VIEW.padX);
    expect(end.x).toBe(BEZIER_VIEW.width - BEZIER_VIEW.padX);
    expect(start.y).toBeLessThan(BEZIER_VIEW.height);
    expect(end.y).toBeGreaterThan(0);
    expect(start.y).toBeGreaterThan(end.y);
  });

  it("samples a path from the start corner to the end corner", () => {
    const path = curvePath(EASING_PRESETS.easeInOut, 8);
    const points = path.split(" L");
    expect(points.length).toBe(9);
    expect(path.startsWith(`M${BEZIER_VIEW.padX.toFixed(2)}`)).toBe(true);
  });

  it("dragHandle clamps x to the unit range and y to the css bounds", () => {
    const base = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
    const farLeft = dragHandle(base, 1, { x: -500, y: 5000 });
    expect(farLeft.x1).toBe(0);
    expect(farLeft.y1).toBe(-2);
    expect(farLeft.x2).toBe(0.58);
    const farRight = dragHandle(base, 2, { x: 5000, y: -5000 });
    expect(farRight.x2).toBe(1);
    expect(farRight.y2).toBe(3);
    const mid = dragHandle(base, 2, curveToSvg({ x: 0.25, y: 0.75 }));
    expect(mid.x2).toBeCloseTo(0.25, 9);
    expect(mid.y2).toBeCloseTo(0.75, 9);
  });
});
