import type { AlertWidgetItemConfig } from "../widgets/alert/alert-widget-config";
import type { OverlayItemType } from "./base";
import {
  buildCompositeClipsConfig,
  type ClipDisplayFieldItemConfig,
  type ClipsWidgetItemConfig,
} from "./clips";
import type {
  ClockWidgetItemConfig,
  CustomWidgetItemConfig,
  IrlFieldWidgetItemConfig,
  TextWidgetItemConfig,
  TimerWidgetItemConfig,
} from "./widgets";
import {
  getAnchor,
  resolveAnchoredPosition,
  type AnchorX,
  type AnchorY,
} from "../lib/item-anchor";

/** Overlay items and scenes: the persisted row shapes and the type guards that
 *  narrow an item's config union. */

export type OverlayItemConfig =
  | ClipsWidgetItemConfig
  | ClipDisplayFieldItemConfig
  | TextWidgetItemConfig
  | TimerWidgetItemConfig
  | ClockWidgetItemConfig
  | IrlFieldWidgetItemConfig
  | CustomWidgetItemConfig
  | AlertWidgetItemConfig;

export interface OverlayItem {
  id: string;
  scene_id: string;
  type: OverlayItemType;
  /**
   * Offset from the anchored edge, in scene px. With the default top-left
   * anchor this is the plain top-left position; anchored `right`, `x` is the
   * gap to the right edge. Resolve with `lib/item-anchor` before rendering.
   */
  x: number;
  y: number;
  /**
   * Which scene edge (or the centre) `x`/`y` are measured from, so an item can
   * stay pinned to a corner when the scene's resolution changes.
   */
  anchor_x: AnchorX;
  anchor_y: AnchorY;
  /** Rendered width in scene px — always `design_w * scale`. */
  w: number;
  /** Rendered height in scene px — always `design_h * scale`. */
  h: number;
  /**
   * Intrinsic size the widget's content is authored at. The renderer lays out at
   * this size and is then scaled by `w / design_w`, so shrinking a widget shrinks
   * its text instead of cropping it. See `lib/item-scale`.
   */
  design_w: number;
  design_h: number;
  /**
   * Crop insets into the design box, in design px. All zero means no crop.
   * The region left over is what fills the rendered rect, so cropping in and
   * scaling back up zooms the widget without moving it off the scene.
   */
  crop_top: number;
  crop_right: number;
  crop_bottom: number;
  crop_left: number;
  z_index: number;
  rotation: number;
  /**
   * Mirror the widget across its own vertical (`flip_h`) or horizontal
   * (`flip_v`) axis. Composed after rotation, so a flipped and rotated item
   * mirrors its content rather than its rotation. See `lib/item-flip`.
   */
  flip_h: boolean;
  flip_v: boolean;
  opacity: number;
  is_visible: boolean;
  is_locked: boolean;
  label: string;
  config: OverlayItemConfig;
}

export interface OverlayScene {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  subscriber_token: string;
  width: number;
  height: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OverlaySceneWithItems extends OverlayScene {
  items: OverlayItem[];
}

export function isTextWidgetItem(item: OverlayItem): boolean {
  return item.type === "text_widget";
}

export function asTextWidgetConfig(
  config: OverlayItemConfig
): TextWidgetItemConfig {
  return config as TextWidgetItemConfig;
}

export function isTimerWidgetItem(item: OverlayItem): boolean {
  return item.type === "timer_widget";
}

export function asTimerWidgetConfig(
  config: OverlayItemConfig
): TimerWidgetItemConfig {
  return config as TimerWidgetItemConfig;
}

export function isClockWidgetItem(item: OverlayItem): boolean {
  return item.type === "clock_widget";
}

export function asClockWidgetConfig(
  config: OverlayItemConfig
): ClockWidgetItemConfig {
  return config as ClockWidgetItemConfig;
}

export function asCustomWidgetConfig(
  config: OverlayItemConfig
): CustomWidgetItemConfig {
  return config as CustomWidgetItemConfig;
}

/** DB row shape from `overlay_items` before typing `type` / `config`. */
export interface OverlayItemDbRow {
  id: string;
  scene_id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Nullable for rows written before the design-size migration landed. */
  design_w?: number | null;
  design_h?: number | null;
  /** Nullable for rows written before the crop migration landed. */
  crop_top?: number | null;
  crop_right?: number | null;
  crop_bottom?: number | null;
  crop_left?: number | null;
  /** Nullable for rows written before the anchor migration landed. */
  anchor_x?: string | null;
  anchor_y?: string | null;
  z_index: number;
  rotation: number;
  /** Nullable for rows written before the flip migration landed. */
  flip_h?: boolean | null;
  flip_v?: boolean | null;
  opacity: number;
  is_visible: boolean;
  is_locked: boolean;
  label: string;
  config: unknown;
}

export function overlayItemFromDbRow(row: OverlayItemDbRow): OverlayItem {
  const anchor = getAnchor(row);
  return {
    ...row,
    type: row.type as OverlayItem["type"],
    // A legacy row with no design size renders at scale 1.
    design_w: row.design_w && row.design_w > 0 ? row.design_w : row.w,
    design_h: row.design_h && row.design_h > 0 ? row.design_h : row.h,
    crop_top: row.crop_top ?? 0,
    crop_right: row.crop_right ?? 0,
    crop_bottom: row.crop_bottom ?? 0,
    crop_left: row.crop_left ?? 0,
    // A legacy row predates flipping, so it is not flipped.
    flip_h: row.flip_h ?? false,
    flip_v: row.flip_v ?? false,
    // A legacy row with no anchor is measured from the top-left, as it always was.
    anchor_x: anchor.x,
    anchor_y: anchor.y,
    config: row.config as OverlayItemConfig,
  };
}

/**
 * Public overlay API: one row per root widget. Clip display fields are merged
 * into the parent `clips_widget` config; child rows are omitted.
 *
 * `x`/`y` are the resolved top-left position for this scene size, so a
 * consumer that predates anchors keeps placing items correctly. The anchor
 * rides along for consumers that want to re-flow at another size.
 */
export function toPublicOverlayApiItems(
  all: OverlayItem[],
  scene: { width: number; height: number }
) {
  return all
    .filter((i) => i.type !== "clip_display_field")
    .map((item) => ({
      id: item.id,
      type: item.type,
      ...resolveAnchoredPosition(item, scene),
      anchor_x: item.anchor_x,
      anchor_y: item.anchor_y,
      w: item.w,
      h: item.h,
      z_index: item.z_index,
      rotation: item.rotation,
      flip_h: item.flip_h,
      flip_v: item.flip_v,
      opacity: item.opacity,
      is_visible: item.is_visible,
      label: item.label,
      config:
        item.type === "clips_widget"
          ? buildCompositeClipsConfig(item, all)
          : item.config,
    }));
}
