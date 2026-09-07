import { clampScale, getSourceSize } from "@repo/ui/overlay";
import type { OverlayItem } from "@/types/overlays";

export type AlignEdge = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";
export type MatchDimension = "width" | "height" | "both";
export type FlipAxis = "horizontal" | "vertical";

export interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One item's share of a layout operation, ready to hand to `updateItem`. */
export interface ItemLayoutUpdate {
  id: string;
  updates: Partial<OverlayItem>;
}

/** Distributing needs a fixed item at each end and at least one to move. */
export const MIN_DISTRIBUTE_ITEMS = 3;

/** The box every selected item fits inside, or null for an empty selection. */
export function selectionBounds(items: OverlayItem[]): LayoutRect | null {
  if (items.length === 0) return null;

  const left = Math.min(...items.map((item) => item.x));
  const top = Math.min(...items.map((item) => item.y));
  const right = Math.max(...items.map((item) => item.x + item.w));
  const bottom = Math.max(...items.map((item) => item.y + item.h));

  return { x: left, y: top, w: right - left, h: bottom - top };
}

function positionOn(item: OverlayItem, edge: AlignEdge, bounds: LayoutRect): Partial<OverlayItem> {
  switch (edge) {
    case "left":
      return { x: Math.max(0, Math.round(bounds.x)) };
    case "hcenter":
      return { x: Math.max(0, Math.round(bounds.x + (bounds.w - item.w) / 2)) };
    case "right":
      return { x: Math.max(0, Math.round(bounds.x + bounds.w - item.w)) };
    case "top":
      return { y: Math.max(0, Math.round(bounds.y)) };
    case "vcenter":
      return { y: Math.max(0, Math.round(bounds.y + (bounds.h - item.h) / 2)) };
    case "bottom":
      return { y: Math.max(0, Math.round(bounds.y + bounds.h - item.h)) };
  }
}

/**
 * Moves each item to an edge of `bounds`. Pass the scene rect to align to the
 * scene, or `selectionBounds(items)` to align items to each other.
 */
export function alignUpdates(
  items: OverlayItem[],
  edge: AlignEdge,
  bounds: LayoutRect
): ItemLayoutUpdate[] {
  return items
    .filter((item) => !item.is_locked)
    .map((item) => ({ id: item.id, updates: positionOn(item, edge, bounds) }));
}

/**
 * Equal gaps between items along one axis. The outermost two anchor the span
 * and never move; a locked item in the middle keeps its slot in the running
 * total but is not written, so the rest still land where they should.
 */
export function distributeUpdates(
  items: OverlayItem[],
  axis: DistributeAxis
): ItemLayoutUpdate[] {
  if (items.length < MIN_DISTRIBUTE_ITEMS) return [];

  const horizontal = axis === "horizontal";
  const start = (item: OverlayItem) => (horizontal ? item.x : item.y);
  const size = (item: OverlayItem) => (horizontal ? item.w : item.h);

  const ordered = [...items].sort((a, b) => start(a) - start(b));
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;

  const span = start(last) + size(last) - start(first);
  const occupied = ordered.reduce((total, item) => total + size(item), 0);
  const gap = (span - occupied) / (ordered.length - 1);

  const updates: ItemLayoutUpdate[] = [];
  let cursor = start(first) + size(first) + gap;

  // The ends are already where they belong, so only the middle is placed.
  for (const item of ordered.slice(1, -1)) {
    if (!item.is_locked) {
      const position = Math.max(0, Math.round(cursor));
      updates.push({
        id: item.id,
        updates: horizontal ? { x: position } : { y: position },
      });
    }
    cursor += size(item) + gap;
  }

  return updates;
}

/**
 * Resizes every other selected item to the primary one.
 *
 * Written as a scale of each item's own source region rather than by setting
 * `w`/`h` directly, so `w = sourceW * scale` still holds and nothing is
 * stretched out of proportion. Matching both dimensions fits the item inside
 * the primary's box, since one uniform scale cannot satisfy two targets.
 */
export function matchSizeUpdates(
  items: OverlayItem[],
  primaryId: string,
  dimension: MatchDimension
): ItemLayoutUpdate[] {
  const primary = items.find((item) => item.id === primaryId);
  if (!primary) return [];

  return items
    .filter((item) => item.id !== primary.id && !item.is_locked)
    .map((item) => {
      const source = getSourceSize(item);
      const byWidth = primary.w / source.w;
      const byHeight = primary.h / source.h;
      const scale = clampScale(
        dimension === "width"
          ? byWidth
          : dimension === "height"
            ? byHeight
            : Math.min(byWidth, byHeight)
      );

      return {
        id: item.id,
        updates: {
          w: Math.round(source.w * scale),
          h: Math.round(source.h * scale),
        },
      };
    });
}

/**
 * Mirrors every unlocked item across the given axis. Each item toggles its
 * own flag rather than being forced one way, so flipping a mixed selection
 * twice puts everything back.
 */
export function flipUpdates(items: OverlayItem[], axis: FlipAxis): ItemLayoutUpdate[] {
  return items
    .filter((item) => !item.is_locked)
    .map((item) => ({
      id: item.id,
      updates:
        axis === "horizontal" ? { flip_h: !item.flip_h } : { flip_v: !item.flip_v },
    }));
}
