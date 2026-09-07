import {
  clampScale,
  getAnchor,
  getSourceSize,
  resolveAnchoredPosition,
} from "@repo/ui/overlay";
import type { OverlayItem } from "@/types/overlays";

/** What to do with the items when the scene's resolution changes. */
export type ResolutionChangeMode = "keep" | "scale";

export interface SceneSize {
  width: number;
  height: number;
}

/**
 * The factor that maps the old scene into the new one without distorting it.
 *
 * The smaller of the two ratios, so a non-uniform change (16:9 to 9:16) fits
 * the whole old layout inside the new canvas instead of pushing half of it off
 * the edge. A uniform change gives the same ratio on both axes.
 */
export function resolutionScale(from: SceneSize, to: SceneSize): number {
  if (from.width <= 0 || from.height <= 0) return 1;
  return Math.min(to.width / from.width, to.height / from.height);
}

/**
 * Repositions and resizes every item so the layout survives a resolution change.
 *
 * Scales positions and sizes by `resolutionScale`, then centres the result in
 * the new canvas — which is a no-op when the aspect ratio is unchanged, and
 * keeps a landscape layout centred when the scene becomes portrait.
 *
 * An anchored axis is handled differently: its offset from the edge (or the
 * centre) is scaled and the item stays anchored, so a bottom-right widget is
 * still in the bottom-right corner of a portrait canvas rather than floating
 * at the bottom of a letterboxed block. For a uniform change the two rules land
 * on the same pixel, so anchoring only makes a difference where it should.
 *
 * Locked items move too. Locking protects an item from editing gestures; leaving
 * it pinned to its old pixel position while everything around it rescales would
 * wreck the design rather than protect it.
 */
export function rescaleItemsForResolution(
  items: OverlayItem[],
  from: SceneSize,
  to: SceneSize
): OverlayItem[] {
  const scale = resolutionScale(from, to);
  const offsetX = (to.width - from.width * scale) / 2;
  const offsetY = (to.height - from.height * scale) / 2;

  return items.map((item) => {
    const source = getSourceSize(item);
    const currentScale = source.w > 0 ? item.w / source.w : 1;
    const nextScale = clampScale(currentScale * scale);
    const anchor = getAnchor(item);
    const position = resolveAnchoredPosition(item, from);

    return {
      ...item,
      x: Math.round(anchor.x === "left" ? position.x * scale + offsetX : item.x * scale),
      y: Math.round(anchor.y === "top" ? position.y * scale + offsetY : item.y * scale),
      w: Math.round(source.w * nextScale),
      h: Math.round(source.h * nextScale),
    };
  });
}

/**
 * A one-line summary of what pressing Apply will do, for the dialog.
 * Deliberately concrete: the streamer should not have to guess.
 */
export function describeResolutionChange(
  mode: ResolutionChangeMode,
  from: SceneSize,
  to: SceneSize
): string {
  if (from.width === to.width && from.height === to.height) {
    return "That's the size it already is.";
  }
  if (mode === "keep") {
    const shrinking = to.width < from.width || to.height < from.height;
    return shrinking
      ? "Everything stays where it is. Anything past the new edge will sit outside the canvas until you move it."
      : "Everything stays where it is, with more room around it.";
  }
  const percent = Math.round(resolutionScale(from, to) * 100);
  return `Everything moves and resizes to ${percent}% so the layout looks the same.`;
}
