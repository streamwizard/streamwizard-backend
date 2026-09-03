import type { RenderNode } from "../core/types";

/** What the stage remembers per clip so a frame only touches styles that changed. */
export interface StageNode {
  el: HTMLElement;
  media: HTMLMediaElement | null;
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
    last: { hidden: true, transform: "", origin: "", width: -1, height: -1, opacity: -1 },
  };
}

const round = (v: number) => Math.round(v * 1000) / 1000;

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
}

export function hideNode(target: StageNode): void {
  if (target.last.hidden) return;
  target.el.style.display = "none";
  target.last.hidden = true;
}
