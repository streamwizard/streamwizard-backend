"use client";

import type { CSSProperties, ReactNode } from "react";
import type { OverlayItem } from "./types";
import {
  getCropInsets,
  getDesignSize,
  getItemScale,
  hasCrop,
} from "./lib/item-scale";

/**
 * Lays a widget out at its intrinsic design size and scales the result to fill
 * the item's rendered rect. Every px inside the renderer — font sizes, padding,
 * borders — scales with it, so a widget dragged to half size looks half size
 * instead of cropped.
 *
 * When the item is cropped, the design box is offset so the cropped-in corner
 * lands at the top-left of the rect, and the frame clips what falls outside.
 *
 * Used by both the editor canvas and the live overlay so the two cannot drift.
 */
export function WidgetScaleFrame({
  item,
  children,
  style,
}: {
  item: OverlayItem;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const design = getDesignSize(item);
  const scale = getItemScale(item);

  // Uncropped widgets render exactly as before — notably without a clipping
  // wrapper, so renderers that animate outside their box (alerts) still can.
  if (!hasCrop(item)) {
    return (
      <div
        style={{
          width: design.w,
          height: design.h,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: "top left",
          boxSizing: "border-box",
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  const crop = getCropInsets(item);

  return (
    <div
      style={{
        width: item.w,
        height: item.h,
        overflow: "hidden",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: design.w,
          height: design.h,
          // Right-to-left: shift the design box so the crop origin sits at 0,0,
          // then scale the whole thing up into the rect.
          transform: `scale(${scale}) translate(${-crop.left}px, ${-crop.top}px)`,
          transformOrigin: "top left",
          boxSizing: "border-box",
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
