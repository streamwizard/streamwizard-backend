import type { OverlayItem } from "../types";

/**
 * Where an item's `x`/`y` are measured from.
 *
 * Position used to be a top-left offset and nothing more, so "align right" was
 * a one-shot move: the item sat on the right edge only until something about
 * the scene changed. An anchor turns that into a relationship. `x` is the
 * distance from the anchored edge (or from the centred position), so an item
 * anchored `right` with `x: 0` hugs the right edge at any scene width, and the
 * same row lands in the same place in the editor, in OBS and in the portrait
 * GPS view.
 *
 * Every renderer goes through `resolveAnchoredPosition`, and everything that
 * does its maths in absolute scene space converts back with `toAnchoredOffset`.
 * Nothing else interprets an anchor, so the editor and the live overlay cannot
 * drift apart.
 */

export const ANCHOR_X_VALUES = ["left", "center", "right"] as const;
export const ANCHOR_Y_VALUES = ["top", "center", "bottom"] as const;

export type AnchorX = (typeof ANCHOR_X_VALUES)[number];
export type AnchorY = (typeof ANCHOR_Y_VALUES)[number];

/** Top-left: what every row written before anchors existed means. */
export const DEFAULT_ANCHOR_X: AnchorX = "left";
export const DEFAULT_ANCHOR_Y: AnchorY = "top";

export interface Anchor {
  x: AnchorX;
  y: AnchorY;
}

export interface Point {
  x: number;
  y: number;
}

export interface SceneSize {
  width: number;
  height: number;
}

/**
 * Anything that may carry an anchor: a typed item, a raw DB row (plain strings,
 * nullable) or a recovered draft with no anchor fields at all.
 */
type MaybeAnchored = { anchor_x?: unknown; anchor_y?: unknown };

/** The size and anchor that decide where an offset of zero lands. */
type AnchoredFrame = Pick<OverlayItem, "w" | "h"> & MaybeAnchored;

/** A frame plus the stored offsets. */
type AnchoredBox = AnchoredFrame & Pick<OverlayItem, "x" | "y">;

export function isAnchorX(value: unknown): value is AnchorX {
  return (ANCHOR_X_VALUES as readonly unknown[]).includes(value);
}

export function isAnchorY(value: unknown): value is AnchorY {
  return (ANCHOR_Y_VALUES as readonly unknown[]).includes(value);
}

/**
 * The item's anchor, defaulting to top-left. Tolerates rows and recovered
 * drafts written before the columns existed, which carry no anchor at all.
 */
export function getAnchor(item: MaybeAnchored): Anchor {
  return {
    x: isAnchorX(item.anchor_x) ? item.anchor_x : DEFAULT_ANCHOR_X,
    y: isAnchorY(item.anchor_y) ? item.anchor_y : DEFAULT_ANCHOR_Y,
  };
}

/** Whether the item is anchored anywhere other than the top-left default. */
export function isAnchored(item: MaybeAnchored): boolean {
  const anchor = getAnchor(item);
  return anchor.x !== DEFAULT_ANCHOR_X || anchor.y !== DEFAULT_ANCHOR_Y;
}

/** The absolute top-left an offset of zero puts the frame at. */
function anchorOrigin(frame: AnchoredFrame, scene: SceneSize): Point {
  const anchor = getAnchor(frame);
  return {
    x:
      anchor.x === "left"
        ? 0
        : anchor.x === "right"
          ? scene.width - frame.w
          : (scene.width - frame.w) / 2,
    y:
      anchor.y === "top"
        ? 0
        : anchor.y === "bottom"
          ? scene.height - frame.h
          : (scene.height - frame.h) / 2,
  };
}

/**
 * Which way a growing offset moves the item. Measured from the right or bottom
 * edge it moves inward, so the offset stays a positive "distance from the edge".
 * A centred offset keeps the usual direction: positive is right/down.
 */
function anchorSign(anchor: Anchor): Point {
  return {
    x: anchor.x === "right" ? -1 : 1,
    y: anchor.y === "bottom" ? -1 : 1,
  };
}

/**
 * The item's absolute top-left corner in scene px. The one place an anchor is
 * turned into a position; both renderers call this and nothing else.
 */
export function resolveAnchoredPosition(item: AnchoredBox, scene: SceneSize): Point {
  const origin = anchorOrigin(item, scene);
  const sign = anchorSign(getAnchor(item));
  return {
    x: origin.x + sign.x * item.x,
    y: origin.y + sign.y * item.y,
  };
}

/**
 * The inverse: the offsets to store so a frame of this size and anchor lands
 * with its top-left at `absolute`. Drag, resize and layout maths work in
 * absolute scene space and convert here, right before writing to the item.
 */
export function toAnchoredOffset(
  absolute: Point,
  frame: AnchoredFrame,
  scene: SceneSize
): Point {
  const origin = anchorOrigin(frame, scene);
  const sign = anchorSign(getAnchor(frame));
  // `|| 0` folds the -0 a flipped axis produces on the edge itself into a
  // plain 0, so it compares and serialises like every other zero.
  return {
    x: sign.x * (absolute.x - origin.x) || 0,
    y: sign.y * (absolute.y - origin.y) || 0,
  };
}

/**
 * A copy of the item with `x`/`y` swapped for its absolute position, for maths
 * that reads rects straight off items (snapping, selection bounds, hit tests).
 * Never write the result back without converting through `toAnchoredOffset`.
 */
export function withAbsolutePosition<T extends AnchoredBox>(item: T, scene: SceneSize): T {
  return { ...item, ...resolveAnchoredPosition(item, scene) };
}
