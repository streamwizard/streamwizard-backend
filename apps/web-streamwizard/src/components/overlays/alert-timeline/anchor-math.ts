/**
 * Anchor changes that leave the box where it is. `x`/`y` position the anchor
 * point, so moving the anchor inside the box has to move `x`/`y` by the same
 * amount in world space, or the whole node jumps.
 */

import type { Clip, PropName } from "@repo/alert-scene";
import type { Anchor, AnchorX, AnchorY } from "@repo/ui/overlay";
import { valueAt } from "./prop-writer";

export interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  /** degrees */
  rotation: number;
  anchorX: number;
  anchorY: number;
}

export function reanchorNode(box: NodeBox, anchorX: number, anchorY: number): { x: number; y: number; anchorX: number; anchorY: number } {
  const dxLocal = (anchorX - box.anchorX) * box.width * box.scaleX;
  const dyLocal = (anchorY - box.anchorY) * box.height * box.scaleY;
  const r = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return {
    x: box.x + dxLocal * cos - dyLocal * sin,
    y: box.y + dxLocal * sin + dyLocal * cos,
    anchorX,
    anchorY,
  };
}

const X_CELLS: Record<AnchorX, number> = { left: 0, center: 0.5, right: 1 };
const Y_CELLS: Record<AnchorY, number> = { top: 0, center: 0.5, bottom: 1 };

function nearestKey<K extends string>(cells: Record<K, number>, value: number): K {
  let best: K | null = null;
  let bestDist = Infinity;
  for (const key in cells) {
    const d = Math.abs(cells[key] - value);
    if (d < bestDist) {
      bestDist = d;
      best = key;
    }
  }
  return best as K;
}

/** The 3x3 cell closest to an arbitrary anchor, for the picker's highlight. */
export function anchorToCell(anchorX: number, anchorY: number): Anchor {
  return { x: nearestKey(X_CELLS, anchorX), y: nearestKey(Y_CELLS, anchorY) };
}

/** True when the anchor sits exactly on a cell, so the highlight is honest. */
export function anchorIsOnCell(anchorX: number, anchorY: number): boolean {
  const cell = anchorToCell(anchorX, anchorY);
  return Math.abs(X_CELLS[cell.x] - anchorX) < 1e-6 && Math.abs(Y_CELLS[cell.y] - anchorY) < 1e-6;
}

export function cellToAnchor(cell: Anchor): { anchorX: number; anchorY: number } {
  return { anchorX: X_CELLS[cell.x], anchorY: Y_CELLS[cell.y] };
}

/** The box as it stands at `timeMs`, tracks included, for compensation maths. */
export function nodeBoxAt(clip: Clip, timeMs: number): NodeBox {
  const at = (prop: PropName) => valueAt(clip, prop, timeMs);
  return {
    x: at("x"),
    y: at("y"),
    width: at("width"),
    height: at("height"),
    scaleX: at("scaleX"),
    scaleY: at("scaleY"),
    rotation: at("rotation"),
    anchorX: at("anchorX"),
    anchorY: at("anchorY"),
  };
}
