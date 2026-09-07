import type { OverlayItem } from "../types";

/**
 * Mirroring an item across its own axes.
 *
 * `flip_h` mirrors left-to-right, `flip_v` top-to-bottom. Both are composed
 * *after* rotation (`rotate() scaleX() scaleY()`), so the item is mirrored in
 * its own frame and the mirrored result is then turned. That is what a
 * designer expects: flipping a logo tilted 30° keeps it tilted 30°; it does
 * not swing over to -30°.
 *
 * Both renderers go through here, so the editor and OBS can never disagree
 * about what a flipped and rotated item looks like.
 */

type FlipFlags = Pick<OverlayItem, "flip_h" | "flip_v">;

/** The scale that mirrors an item, or `undefined` when it is not flipped. */
export function itemFlipTransform(item: FlipFlags): string | undefined {
  if (!item.flip_h && !item.flip_v) return undefined;
  return `scaleX(${item.flip_h ? -1 : 1}) scaleY(${item.flip_v ? -1 : 1})`;
}

/** The whole item transform: rotate, then mirror. */
export function itemTransform(item: Pick<OverlayItem, "rotation"> & FlipFlags): string {
  const rotate = `rotate(${item.rotation}deg)`;
  const flip = itemFlipTransform(item);
  return flip ? `${rotate} ${flip}` : rotate;
}
