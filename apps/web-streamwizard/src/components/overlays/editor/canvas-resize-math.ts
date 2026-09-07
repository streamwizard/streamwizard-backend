import { clampCrop, clampScale, type CropInsets } from "@repo/ui/overlay";
import type { OverlayItem } from "@/types/overlays";
import { MIN_ITEM_SIZE } from "./overlay-item-helpers";

/**
 * Pure resize/crop maths for canvas drags. Everything here works off the
 * gesture's starting snapshot plus the pointer delta, so it can be reasoned
 * about (and corrected) without a mouse.
 */

/**
 * Which axis a Shift-held move drag should follow, or null while the pointer
 * hasn't travelled far enough to have committed to one.
 *
 * Deltas are in scene units, so they are scaled back by `zoom` to measure real
 * pointer travel — the threshold is about how far the hand moved, not how far
 * the widget did. A tie goes to the horizontal axis.
 */
export function resolveDragAxis(
  dx: number,
  dy: number,
  zoom: number,
  thresholdPx: number
): "x" | "y" | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) * zoom < thresholdPx) return null;
  return Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
}

/** One item's geometry at the moment a drag started. */
export interface DragItemStart {
  id: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  startDesignW: number;
  startDesignH: number;
  startCrop: CropInsets;
  startScale: number;
}

/**
 * Alt-drag: the handles become crop handles. Scale stays put and the box
 * shrinks as content is cropped away, so the visible content never moves under
 * the cursor. Crop in, then drag normally to stretch the remaining slice back
 * up — that is a zoom that stays on the canvas.
 */
export function computeCropUpdate(
  it: DragItemStart,
  handle: string,
  dx: number,
  dy: number,
): Partial<OverlayItem> {
  const design = { w: it.startDesignW, h: it.startDesignH };

  // Pointer travel expressed in design px.
  const ddx = dx / it.startScale;
  const ddy = dy / it.startScale;

  const next = { ...it.startCrop };
  if (handle.includes("e")) next.right = it.startCrop.right - ddx;
  if (handle.includes("w")) next.left = it.startCrop.left + ddx;
  if (handle.includes("s")) next.bottom = it.startCrop.bottom - ddy;
  if (handle.includes("n")) next.top = it.startCrop.top + ddy;

  const crop = clampCrop(next, design);
  const newW = (design.w - crop.left - crop.right) * it.startScale;
  const newH = (design.h - crop.top - crop.bottom) * it.startScale;

  // Cropping from the left/top shrinks the box from that side, so the content
  // that survives stays exactly where it was on screen.
  const newX = handle.includes("w") ? it.startX + (it.startW - newW) : it.startX;
  const newY = handle.includes("n") ? it.startY + (it.startH - newH) : it.startY;

  return {
    x: Math.round(newX),
    y: Math.round(newY),
    w: Math.round(newW),
    h: Math.round(newH),
    crop_top: crop.top,
    crop_right: crop.right,
    crop_bottom: crop.bottom,
    crop_left: crop.left,
  };
}

/**
 * Plain resize. Corners scale the widget and everything in it; edges only
 * reflow the frame, which is how you widen a text box without growing the text.
 * Shift on a corner forces the reflow behaviour.
 */
export function computeResizeUpdate(
  it: DragItemStart,
  handle: string,
  dx: number,
  dy: number,
  shiftKey: boolean,
): Partial<OverlayItem> {
  const isCorner = handle.length === 2;
  const uniform = isCorner && !shiftKey;

  let newW = it.startW;
  let newH = it.startH;
  let newX = it.startX;
  let newY = it.startY;
  let newDesignW = it.startDesignW;
  let newDesignH = it.startDesignH;

  // The box shows the cropped slice, not the whole design box, so all the
  // scale maths works off the source region.
  const sourceW = it.startDesignW - it.startCrop.left - it.startCrop.right;
  const sourceH = it.startDesignH - it.startCrop.top - it.startCrop.bottom;

  if (uniform) {
    // Take whichever axis the pointer moved furthest along so the drag tracks
    // the cursor on the dominant direction.
    const signedDx = handle.includes("w") ? -dx : dx;
    const signedDy = handle.includes("n") ? -dy : dy;
    const byW = (it.startW + signedDx) / it.startW;
    const byH = (it.startH + signedDy) / it.startH;
    const ratio = Math.abs(signedDx) >= Math.abs(signedDy) ? byW : byH;
    const scale = clampScale(it.startScale * ratio);
    newW = Math.max(MIN_ITEM_SIZE, sourceW * scale);
    newH = Math.max(MIN_ITEM_SIZE, sourceH * scale);
  } else {
    // Reflow grows the design box; the crop insets ride along unchanged, so the
    // extra room lands in the visible slice.
    if (handle.includes("e") || handle.includes("w")) {
      const delta = handle.includes("w") ? -dx : dx;
      newW = Math.max(MIN_ITEM_SIZE, it.startW + delta);
      newDesignW = newW / it.startScale + it.startCrop.left + it.startCrop.right;
    }
    if (handle.includes("s") || handle.includes("n")) {
      const delta = handle.includes("n") ? -dy : dy;
      newH = Math.max(MIN_ITEM_SIZE, it.startH + delta);
      newDesignH = newH / it.startScale + it.startCrop.top + it.startCrop.bottom;
    }
  }

  // Dragging a west/north edge keeps the opposite side pinned.
  if (handle.includes("w")) newX = it.startX + (it.startW - newW);
  if (handle.includes("n")) newY = it.startY + (it.startH - newH);

  return {
    x: Math.round(newX),
    y: Math.round(newY),
    w: Math.round(newW),
    h: Math.round(newH),
    design_w: newDesignW,
    design_h: newDesignH,
  };
}

/**
 * How far a group move may travel before some member would leave the scene.
 * Clamping at gesture level (rather than per item) keeps the group's relative
 * layout intact.
 */
export function groupMoveBounds(items: DragItemStart[], scene: { width: number; height: number }) {
  let minDx = -Infinity;
  let maxDx = Infinity;
  let minDy = -Infinity;
  let maxDy = Infinity;

  for (const it of items) {
    minDx = Math.max(minDx, -it.startX);
    maxDx = Math.min(maxDx, scene.width - it.startX - it.startW);
    minDy = Math.max(minDy, -it.startY);
    maxDy = Math.min(maxDy, scene.height - it.startY - it.startH);
  }

  return { minDx, maxDx, minDy, maxDy };
}
