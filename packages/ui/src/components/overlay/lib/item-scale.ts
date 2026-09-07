import type { OverlayItem } from "../types";

/**
 * Widgets are authored at an intrinsic "design size" (`design_w` x `design_h`).
 * A crop may hide some of that content; whatever is left — the *source* region —
 * is drawn into the rendered rect (`w` x `h`) with a uniform CSS transform.
 *
 * That is what makes a half-size widget show half-size text instead of a
 * cropped full-size one, and what makes "crop in, then stretch back out" behave
 * as a zoom without the item ever leaving the scene.
 *
 * `scale` is always derived from the width — height follows from the source
 * aspect — so the two axes can never disagree.
 */

export const MIN_ITEM_SCALE = 0.05;
export const MAX_ITEM_SCALE = 10;
/** Smallest source region a crop may leave, in design px. */
export const MIN_SOURCE_SIZE = 10;

export interface Size {
  w: number;
  h: number;
}

export interface CropInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_CROP: CropInsets = { top: 0, right: 0, bottom: 0, left: 0 };

type ItemGeometry = Pick<OverlayItem, "w" | "h"> &
  Partial<
    Pick<
      OverlayItem,
      | "design_w"
      | "design_h"
      | "crop_top"
      | "crop_right"
      | "crop_bottom"
      | "crop_left"
    >
  >;

/**
 * Intrinsic design box. Falls back to the rendered rect for rows written before
 * the design-size migration, so a legacy item reads as scale 1 rather than
 * dividing by zero.
 */
export function getDesignSize(item: ItemGeometry): Size {
  const w = item.design_w;
  const h = item.design_h;
  return {
    w: typeof w === "number" && w > 0 ? w : item.w,
    h: typeof h === "number" && h > 0 ? h : item.h,
  };
}

function inset(value: number | null | undefined): number {
  return typeof value === "number" && value > 0 ? value : 0;
}

export function getCropInsets(item: ItemGeometry): CropInsets {
  return {
    top: inset(item.crop_top),
    right: inset(item.crop_right),
    bottom: inset(item.crop_bottom),
    left: inset(item.crop_left),
  };
}

export function hasCrop(item: ItemGeometry): boolean {
  const c = getCropInsets(item);
  return c.top > 0 || c.right > 0 || c.bottom > 0 || c.left > 0;
}

/**
 * The visible slice of the design box — design size minus the crop insets.
 * This, not the design size, is what the rendered rect displays.
 */
export function getSourceSize(item: ItemGeometry): Size {
  const design = getDesignSize(item);
  const crop = getCropInsets(item);
  return {
    w: Math.max(MIN_SOURCE_SIZE, design.w - crop.left - crop.right),
    h: Math.max(MIN_SOURCE_SIZE, design.h - crop.top - crop.bottom),
  };
}

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_ITEM_SCALE, Math.max(MIN_ITEM_SCALE, scale));
}

/** Uniform content scale of an item. */
export function getItemScale(item: ItemGeometry): number {
  const source = getSourceSize(item);
  if (source.w <= 0) return 1;
  return clampScale(item.w / source.w);
}

/** Rendered rect produced by a source region at a given scale. */
export function applyScale(source: Size, scale: number): Size {
  const s = clampScale(scale);
  return { w: source.w * s, h: source.h * s };
}

/**
 * Clamp crop insets so they stay non-negative and always leave a renderable
 * slice on both axes. Mirrors the DB check constraints.
 */
export function clampCrop(crop: CropInsets, design: Size): CropInsets {
  const clampAxis = (a: number, b: number, extent: number) => {
    const lo = Math.max(0, a);
    const hi = Math.max(0, b);
    const room = Math.max(0, extent - MIN_SOURCE_SIZE);
    if (lo + hi <= room) return [lo, hi] as const;
    // Safety net only — callers clamp the edge they are dragging themselves.
    // Give up ground on the far edge so the near one lands where asked.
    const keptLo = Math.min(lo, room);
    return [keptLo, room - keptLo] as const;
  };

  const [left, right] = clampAxis(crop.left, crop.right, design.w);
  const [top, bottom] = clampAxis(crop.top, crop.bottom, design.h);
  return { top, right, bottom, left };
}
