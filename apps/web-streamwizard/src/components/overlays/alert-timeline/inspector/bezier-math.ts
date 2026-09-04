/**
 * Curve ↔ picture maths for the easing editor. The picture is a fixed
 * viewBox with room above and below the unit square, so overshoot curves
 * (back out) stay visible instead of clipping at the edge.
 */

import { EASING_PRESETS, clampBezier, cubicBezier, isBezier, type CubicBezierEasing, type Easing, type EasingPresetName } from "@repo/alert-scene";

export type PresetChoice = EasingPresetName | "custom";

export const PRESET_OPTIONS: ReadonlyArray<{ value: PresetChoice; label: string }> = [
  { value: "linear", label: "Linear" },
  { value: "hold", label: "Hold" },
  { value: "easeIn", label: "Ease in" },
  { value: "easeOut", label: "Ease out" },
  { value: "easeInOut", label: "Ease in-out" },
  { value: "easeOutStrong", label: "Strong out" },
  { value: "backOut", label: "Back out" },
  { value: "custom", label: "Custom" },
];

const EPS = 1e-6;

function sameBezier(a: CubicBezierEasing, b: CubicBezierEasing): boolean {
  return Math.abs(a.x1 - b.x1) < EPS && Math.abs(a.y1 - b.y1) < EPS && Math.abs(a.x2 - b.x2) < EPS && Math.abs(a.y2 - b.y2) < EPS;
}

/** Which preset an easing is, or "custom" when the handles were moved by hand. */
export function presetForEasing(easing: Easing): PresetChoice {
  for (const name in EASING_PRESETS) {
    const preset = EASING_PRESETS[name as EasingPresetName];
    if (isBezier(preset) && isBezier(easing) ? sameBezier(preset, easing) : preset === easing) return name as EasingPresetName;
  }
  return "custom";
}

/** The easing a preset choice stands for; "custom" keeps the current curve, or starts from ease-out. */
export function easingForPreset(choice: PresetChoice, current: Easing): Easing {
  if (choice === "custom") return isBezier(current) ? current : { ...EASING_PRESETS.easeOut };
  const preset = EASING_PRESETS[choice];
  return isBezier(preset) ? { ...preset } : preset;
}

/** The curve to draw and drag: linear is the diagonal bezier, hold has no handles. */
export function asBezier(easing: Easing): CubicBezierEasing | null {
  if (easing === "hold") return null;
  if (easing === "linear") return { x1: 0, y1: 0, x2: 1, y2: 1 };
  return easing;
}

export const BEZIER_VIEW = {
  width: 200,
  height: 200,
  /** Curve-space y range that fills the picture; the unit square sits inside it. */
  yMin: -0.5,
  yMax: 1.5,
  /** Horizontal inset so handles on x=0 / x=1 are not cut in half. */
  padX: 8,
} as const;

export interface SvgPoint {
  x: number;
  y: number;
}

export function curveToSvg(p: { x: number; y: number }): SvgPoint {
  const { width, height, yMin, yMax, padX } = BEZIER_VIEW;
  return {
    x: padX + p.x * (width - 2 * padX),
    y: height - ((p.y - yMin) / (yMax - yMin)) * height,
  };
}

export function svgToCurve(p: SvgPoint): { x: number; y: number } {
  const { width, height, yMin, yMax, padX } = BEZIER_VIEW;
  return {
    x: (p.x - padX) / (width - 2 * padX),
    y: yMin + ((height - p.y) / height) * (yMax - yMin),
  };
}

/** SVG path for the eased curve, sampled evenly in x. */
export function curvePath(curve: CubicBezierEasing, samples = 64): string {
  const parts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = i / samples;
    const p = curveToSvg({ x, y: cubicBezier(curve, x) });
    parts.push(`${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  }
  return parts.join(" ");
}

/** A handle dropped at an SVG point, clamped to what CSS allows. */
export function dragHandle(curve: CubicBezierEasing, which: 1 | 2, at: SvgPoint): CubicBezierEasing {
  const p = svgToCurve(at);
  return clampBezier(which === 1 ? { ...curve, x1: p.x, y1: p.y } : { ...curve, x2: p.x, y2: p.y });
}

/** The two handle positions in picture space. */
export function handlePoints(curve: CubicBezierEasing): { p1: SvgPoint; p2: SvgPoint; start: SvgPoint; end: SvgPoint } {
  return {
    start: curveToSvg({ x: 0, y: 0 }),
    end: curveToSvg({ x: 1, y: 1 }),
    p1: curveToSvg({ x: curve.x1, y: curve.y1 }),
    p2: curveToSvg({ x: curve.x2, y: curve.y2 }),
  };
}
