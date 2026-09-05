import { graphemeFrame, hasTextAnimation, type GraphemeFrame } from "../core/text-preset";
import type { RenderNode, TextSource } from "../core/types";

/** The grapheme spans of an animated text clip, plus what was last written to each. */
interface TextPresetState {
  spans: HTMLElement[];
  last: (GraphemeFrame | null)[];
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
  const state: TextPresetState = { spans, last: new Array<GraphemeFrame | null>(spans.length).fill(null) };
  target.text = state;
  return state;
}

/**
 * Paints the text's animate in / animate out from the clip's local time only:
 * typewriter flips visibility, stagger writes opacity and a lift. Only spans
 * whose frame changed are touched; layout is never.
 */
function applyTextPreset(target: StageNode, node: RenderNode, src: TextSource): void {
  const state = target.text ?? collectText(target);
  const n = state.spans.length;
  for (let i = 0; i < n; i++) {
    const f = graphemeFrame(i, n, node.localTime, node.clipDuration, src);
    f.opacity = round(f.opacity);
    f.lift = round(f.lift);
    const prev = state.last[i];
    if (prev && prev.visible === f.visible && prev.opacity === f.opacity && prev.lift === f.lift) continue;
    const span = state.spans[i]!;
    if (!prev || prev.visible !== f.visible) span.style.visibility = f.visible ? "" : "hidden";
    if (!prev || prev.opacity !== f.opacity) span.style.opacity = f.opacity >= 1 ? "" : String(f.opacity);
    if (!prev || prev.lift !== f.lift) span.style.top = f.lift === 0 ? "" : `${f.lift}em`;
    state.last[i] = f;
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
  if (node.source.kind === "text" && hasTextAnimation(node.source)) applyTextPreset(target, node, node.source);
}

export function hideNode(target: StageNode): void {
  if (target.last.hidden) return;
  target.el.style.display = "none";
  target.last.hidden = true;
}
