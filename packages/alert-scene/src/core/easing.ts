import type { CubicBezierEasing, Easing } from "./types";

export const EASING_PRESETS = {
  linear: "linear",
  hold: "hold",
  easeIn: { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  easeOut: { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  easeInOut: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  /** The house curve from globals.css (`--ease-out-strong`). */
  easeOutStrong: { x1: 0.23, y1: 1, x2: 0.32, y2: 1 },
  backOut: { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
} as const satisfies Record<string, Easing>;

export type EasingPresetName = keyof typeof EASING_PRESETS;

const NEWTON_ITERATIONS = 8;
const NEWTON_MIN_SLOPE = 0.001;
const BISECT_PRECISION = 1e-7;
const BISECT_MAX = 32;

function bezierComponent(a1: number, a2: number, t: number): number {
  // Cubic bezier from (0,0) through (a1),(a2) to (1,1), one axis.
  return ((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t * t + 3 * a1 * t;
}

function bezierSlope(a1: number, a2: number, t: number): number {
  return 3 * (1 - 3 * a2 + 3 * a1) * t * t + 2 * (3 * a2 - 6 * a1) * t + 3 * a1;
}

function solveT(x1: number, x2: number, x: number): number {
  let t = x;
  for (let i = 0; i < NEWTON_ITERATIONS; i++) {
    const slope = bezierSlope(x1, x2, t);
    if (Math.abs(slope) < NEWTON_MIN_SLOPE) break;
    const err = bezierComponent(x1, x2, t) - x;
    if (Math.abs(err) < BISECT_PRECISION) return t;
    t -= err / slope;
  }
  // Newton wandered or stalled: fall back to bisection, which always converges
  // because x(t) is monotone for x1,x2 in [0,1].
  let lo = 0;
  let hi = 1;
  t = x;
  for (let i = 0; i < BISECT_MAX && hi - lo > BISECT_PRECISION; i++) {
    const cx = bezierComponent(x1, x2, t);
    if (cx < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return t;
}

/** y for a given x on a CSS `cubic-bezier(x1, y1, x2, y2)` curve. x in [0, 1]. */
export function cubicBezier(curve: CubicBezierEasing, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const { x1, y1, x2, y2 } = curve;
  if (x1 === y1 && x2 === y2) return x;
  return bezierComponent(y1, y2, solveT(x1, x2, x));
}

/**
 * Maps linear progress `u` (0..1 between two keyframes) to eased progress.
 * `hold` sits on the leading keyframe's value until the next one.
 */
export function easeProgress(u: number, easing: Easing): number {
  const p = u <= 0 ? 0 : u >= 1 ? 1 : u;
  if (easing === "linear") return p;
  if (easing === "hold") return 0;
  return cubicBezier(easing, p);
}

export function isBezier(easing: Easing): easing is CubicBezierEasing {
  return typeof easing === "object" && easing !== null;
}

/** Control points clamped to the CSS rule: x in [0,1], y unrestricted. */
export function clampBezier(curve: CubicBezierEasing): CubicBezierEasing {
  const c = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
  const y = (v: number) => (Number.isFinite(v) ? Math.min(3, Math.max(-2, v)) : 0);
  return { x1: c(curve.x1), y1: y(curve.y1), x2: c(curve.x2), y2: y(curve.y2) };
}
