/**
 * Screen-side maths for the preview overlay: where a node's corners are,
 * what sits under the pointer, and how a corner or rotation drag turns into
 * new base values. Everything is in scene pixels; the overlay multiplies by
 * the preview scale on the way in and out.
 *
 * Matches the renderer: a node's local box is `width × height` with the
 * transform origin at `(anchorX·width, anchorY·height)`, and that origin
 * lands on `(x, y)` after `rotate(rotation) scale(scaleX, scaleY)`.
 */

import type { NodeBox } from "../anchor-math";

export interface Point {
  x: number;
  y: number;
}

export type Corner = "tl" | "tr" | "br" | "bl";
export const CORNERS: readonly Corner[] = ["tl", "tr", "br", "bl"];

const DEG = Math.PI / 180;
export const MIN_NODE_SIZE = 1;

/** A point in the node's unscaled local box → scene space. */
export function localToWorld(box: NodeBox, lx: number, ly: number): Point {
  const ox = box.anchorX * box.width;
  const oy = box.anchorY * box.height;
  const sx = (lx - ox) * box.scaleX;
  const sy = (ly - oy) * box.scaleY;
  const r = box.rotation * DEG;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: box.x + sx * cos - sy * sin, y: box.y + sx * sin + sy * cos };
}

/** Scene space → the node's unscaled local box. Degenerate scales read as 1. */
export function worldToLocal(box: NodeBox, wx: number, wy: number): Point {
  const r = -box.rotation * DEG;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = wx - box.x;
  const dy = wy - box.y;
  const ux = dx * cos - dy * sin;
  const uy = dx * sin + dy * cos;
  const sx = box.scaleX === 0 ? 1 : box.scaleX;
  const sy = box.scaleY === 0 ? 1 : box.scaleY;
  return { x: ux / sx + box.anchorX * box.width, y: uy / sy + box.anchorY * box.height };
}

/** Corners in scene space, tl → tr → br → bl. */
export function nodeCorners(box: NodeBox): Record<Corner, Point> {
  return {
    tl: localToWorld(box, 0, 0),
    tr: localToWorld(box, box.width, 0),
    br: localToWorld(box, box.width, box.height),
    bl: localToWorld(box, 0, box.height),
  };
}

export function containsPoint(box: NodeBox, p: Point): boolean {
  const l = worldToLocal(box, p.x, p.y);
  return l.x >= 0 && l.x <= box.width && l.y >= 0 && l.y <= box.height;
}

/** The topmost (last drawn) node under `p`, or null. Rotation and scale aware. */
export function hitTest<T extends NodeBox>(nodes: readonly T[], p: Point): T | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]!;
    if (containsPoint(n, p)) return n;
  }
  return null;
}

const OPPOSITE: Record<Corner, Corner> = { tl: "br", tr: "bl", br: "tl", bl: "tr" };

/**
 * Drags `corner` to `pointer` (scene space) with the opposite corner pinned.
 * The size comes from the pointer in the box's own frame; x/y are then
 * re-solved so the pinned corner does not move, whatever the anchor is.
 */
export function resizeFromCorner(box: NodeBox, corner: Corner, pointer: Point, opts: { keepAspect?: boolean } = {}): Pick<NodeBox, "x" | "y" | "width" | "height"> {
  const l = worldToLocal(box, pointer.x, pointer.y);
  let width = corner === "tl" || corner === "bl" ? box.width - l.x : l.x;
  let height = corner === "tl" || corner === "tr" ? box.height - l.y : l.y;
  width = Math.max(MIN_NODE_SIZE, width);
  height = Math.max(MIN_NODE_SIZE, height);
  if (opts.keepAspect && box.width > 0 && box.height > 0) {
    const s = Math.max(width / box.width, height / box.height);
    width = Math.max(MIN_NODE_SIZE, box.width * s);
    height = Math.max(MIN_NODE_SIZE, box.height * s);
  }
  const pinned = OPPOSITE[corner];
  const pinnedWorld = nodeCorners(box)[pinned];
  // Where the pinned corner sits in the new local box.
  const px = pinned === "tr" || pinned === "br" ? width : 0;
  const py = pinned === "bl" || pinned === "br" ? height : 0;
  const trial: NodeBox = { ...box, width, height, x: 0, y: 0 };
  const at = localToWorld(trial, px, py);
  return { width, height, x: pinnedWorld.x - at.x, y: pinnedWorld.y - at.y };
}

/** Degrees of the vector from `center` to `p`, screen convention (y down). */
export function angleDeg(center: Point, p: Point): number {
  return Math.atan2(p.y - center.y, p.x - center.x) / DEG;
}

/**
 * New rotation for a handle dragged from `startAngle` to the pointer's angle
 * around the anchor. Shift snaps the result to 15° steps.
 */
export function rotationFromPointer(startRotation: number, startAngle: number, center: Point, pointer: Point, opts: { snap?: boolean } = {}): number {
  let r = startRotation + angleDeg(center, pointer) - startAngle;
  if (opts.snap) r = Math.round(r / 15) * 15;
  return Math.round(r * 10) / 10;
}

/** Unit vector pointing "up" out of the box's top edge, in scene space. */
export function upVector(box: NodeBox): Point {
  const r = box.rotation * DEG;
  const flip = box.scaleY < 0 ? -1 : 1;
  return { x: Math.sin(r) * flip, y: -Math.cos(r) * flip };
}
