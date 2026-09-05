/**
 * Text animate in / animate out presets, as pure functions of the clip's
 * local time. The renderer keeps every grapheme in the DOM from the first
 * frame (so the box, the line breaks and the centring never move) and only
 * changes how much of it is painted, per `evaluate()`'s determinism rule:
 * scrub backwards and the letters come back.
 */

import type { TextSource } from "./types";

interface GraphemeSegmenter {
  segment(text: string): Iterable<{ segment: string }>;
}

/** User-perceived characters: "👩‍💻" and "é" (combining) each count once. */
export function splitGraphemes(text: string): string[] {
  const Segmenter = (globalThis as { Intl?: { Segmenter?: new (locale: undefined, opts: { granularity: "grapheme" }) => GraphemeSegmenter } }).Intl?.Segmenter;
  if (typeof Segmenter === "function") {
    return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/**
 * How long the reveal really takes: never past the clip (the whole text must
 * be there before the clip ends) and never zero (no division by it).
 */
export function presetDuration(presetDurationMs: number, clipDurationMs: number): number {
  return Math.max(1, Math.min(presetDurationMs, clipDurationMs));
}

/** Typewriter: how many of `count` graphemes are painted at `localTime`. */
export function typewriterRevealed(count: number, localTime: number, durationMs: number): number {
  if (count <= 0) return 0;
  const progress = Math.min(1, Math.max(0, localTime / durationMs));
  return Math.ceil(count * progress);
}

/** Share of the reveal each grapheme spends fading and lifting. */
export const STAGGER_WINDOW = 0.4;
/** How far (in em) a grapheme starts below its resting place. */
export const STAGGER_LIFT_EM = 0.35;

function easeOutCubic(p: number): number {
  const q = 1 - p;
  return 1 - q * q * q;
}

/**
 * Stagger: progress 0..1 of grapheme `index` of `count`. Starts are spread so
 * the first one begins at 0 and the last lands exactly at the duration; each
 * one takes `STAGGER_WINDOW` of the duration to arrive.
 */
export function staggerProgress(index: number, count: number, localTime: number, durationMs: number): number {
  if (count <= 0) return 1;
  const window = durationMs * STAGGER_WINDOW;
  const lastStart = durationMs - window;
  const start = count > 1 ? (lastStart * index) / (count - 1) : 0;
  const raw = window > 0 ? (localTime - start) / window : localTime >= start ? 1 : 0;
  return easeOutCubic(Math.min(1, Math.max(0, raw)));
}

export type TextAnimation = Pick<TextSource, "preset" | "presetDurationMs" | "presetOut" | "presetOutDurationMs">;

/** True when the clip needs grapheme spans at all. */
export function hasTextAnimation(src: TextAnimation): boolean {
  return src.preset !== "none" || src.presetOut !== "none";
}

/** What one grapheme looks like this frame. */
export interface GraphemeFrame {
  /** Typewriter: painted or not. */
  visible: boolean;
  /** Stagger: 0..1. */
  opacity: number;
  /** Stagger: em below the resting line (positive = lower). */
  lift: number;
}

/**
 * Animate in runs over the first `presetDurationMs` of the clip, animate out
 * over the last `presetOutDurationMs`; each is clamped to the clip and the two
 * simply combine when a short clip makes them overlap. Typewriter types left
 * to right and backspaces right to left; stagger arrives and leaves in reading
 * order, dropping on the way out as it lifted on the way in.
 */
export function graphemeFrame(index: number, count: number, localTime: number, clipDurationMs: number, src: TextAnimation): GraphemeFrame {
  const frame: GraphemeFrame = { visible: true, opacity: 1, lift: 0 };
  if (src.preset === "typewriter") {
    frame.visible = index < typewriterRevealed(count, localTime, presetDuration(src.presetDurationMs, clipDurationMs));
  } else if (src.preset === "stagger") {
    const p = staggerProgress(index, count, localTime, presetDuration(src.presetDurationMs, clipDurationMs));
    frame.opacity *= p;
    frame.lift += (1 - p) * STAGGER_LIFT_EM;
  }
  if (src.presetOut !== "none") {
    const outDuration = presetDuration(src.presetOutDurationMs, clipDurationMs);
    const outTime = localTime - (clipDurationMs - outDuration);
    if (src.presetOut === "typewriter") {
      const removed = typewriterRevealed(count, outTime, outDuration);
      frame.visible = frame.visible && index < count - removed;
    } else {
      const q = staggerProgress(index, count, outTime, outDuration);
      frame.opacity *= 1 - q;
      frame.lift += q * STAGGER_LIFT_EM;
    }
  }
  return frame;
}
