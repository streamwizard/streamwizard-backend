import { STAGGER_LIFT_EM, presetDuration, staggerProgress, typewriterRevealed } from "../core/text-preset";
import type { RenderNode, TextSource } from "../core/types";

/** The grapheme spans of a preset text clip, plus what was last written to them. */
interface TextPresetState {
  spans: HTMLElement[];
  /** Typewriter: spans below this index are visible. -1 = nothing written yet. */
  revealed: number;
  /** Stagger: last progress per span. */
  progress: number[];
}

/** What the stage remembers per clip so a frame only touches styles that changed. */
export interface StageNode {
  el: HTMLElement;
  media: HTMLMediaElement | null;
  /** Null until a preset text clip is first painted, and again whenever its spans may have changed. */
  text: TextPresetState | null;
  last: {
    hidden: boolean;
    transform: string;
    origin: string;
    width: number;
    height: number;
    opacity: number;
  };
}

export function createStageNode(el: HTMLElement, media: HTMLMediaElement | null): StageNode {
  return {
    el,
    media,
    text: null,
    last: { hidden: true, transform: "", origin: "", width: -1, height: -1, opacity: -1 },
  };
}

/** The spans were re-rendered (text, tokens or preset changed): collect them again. */
export function invalidateText(target: StageNode): void {
  target.text = null;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

function collectText(target: StageNode): TextPresetState {
  const spans = Array.from(target.el.querySelectorAll<HTMLElement>("[data-grapheme]"));
  // React may reuse a span across a preset switch; whatever the old preset wrote must go.
  for (const span of spans) {
    span.style.visibility = "";
    span.style.opacity = "";
    span.style.top = "";
  }
  const state: TextPresetState = { spans, revealed: -1, progress: new Array<number>(spans.length).fill(-1) };
  target.text = state;
  return state;
}

/**
 * Paints a text preset from the clip's local time only. Typewriter flips
 * visibility on the spans up to the revealed count; stagger fades and lifts
 * each span by its own progress. Both leave layout alone.
 */
function applyTextPreset(target: StageNode, node: RenderNode, src: TextSource): void {
  const state = target.text ?? collectText(target);
  const n = state.spans.length;
  const duration = presetDuration(src.presetDurationMs, node.clipDuration);
  if (src.preset === "typewriter") {
    const revealed = typewriterRevealed(n, node.localTime, duration);
    if (revealed === state.revealed) return;
    const from = state.revealed < 0 ? 0 : Math.min(state.revealed, revealed);
    const to = state.revealed < 0 ? n : Math.max(state.revealed, revealed);
    for (let i = from; i < to; i++) state.spans[i]!.style.visibility = i < revealed ? "" : "hidden";
    state.revealed = revealed;
    return;
  }
  if (src.preset === "stagger") {
    for (let i = 0; i < n; i++) {
      const p = round(staggerProgress(i, n, node.localTime, duration));
      if (p === state.progress[i]) continue;
      state.progress[i] = p;
      const span = state.spans[i]!;
      span.style.opacity = String(p);
      span.style.top = p >= 1 ? "" : `${round((1 - p) * STAGGER_LIFT_EM)}em`;
    }
  }
}

/** Writes one node's frame. Idempotent: same node in, no style writes. */
export function applyNode(target: StageNode, node: RenderNode): void {
  const { el, last } = target;
  if (last.hidden) {
    el.style.display = "";
    last.hidden = false;
  }
  const tx = round(node.x - node.anchorX * node.width);
  const ty = round(node.y - node.anchorY * node.height);
  const transform = `translate(${tx}px, ${ty}px) rotate(${round(node.rotation)}deg) scale(${round(node.scaleX)}, ${round(node.scaleY)})`;
  if (transform !== last.transform) {
    el.style.transform = transform;
    last.transform = transform;
  }
  const origin = `${round(node.anchorX * 100)}% ${round(node.anchorY * 100)}%`;
  if (origin !== last.origin) {
    el.style.transformOrigin = origin;
    last.origin = origin;
  }
  if (node.width !== last.width) {
    el.style.width = `${node.width}px`;
    last.width = node.width;
  }
  if (node.height !== last.height) {
    el.style.height = `${node.height}px`;
    last.height = node.height;
  }
  if (node.opacity !== last.opacity) {
    el.style.opacity = String(node.opacity);
    last.opacity = node.opacity;
  }
  if (node.source.kind === "text" && node.source.preset !== "none") applyTextPreset(target, node, node.source);
}

export function hideNode(target: StageNode): void {
  if (target.last.hidden) return;
  target.el.style.display = "none";
  target.last.hidden = true;
}
