"use client";

import type { OverlayItem } from "@/types/overlays";
import { DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG, IRL_FIELD_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";
import type { IrlFieldWidgetType } from "@/types/overlays";
import type { CreateRootItemContext } from "../../registry/overlay-widget-registry.types";

export { IRL_FIELD_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

const FIELD_LABELS: Record<IrlFieldWidgetType, string> = {
  irl_speed_widget: "Speed",
  irl_heading_widget: "Heading",
  irl_altitude_widget: "Altitude",
  irl_latitude_widget: "Latitude",
  irl_longitude_widget: "Longitude",
  irl_accuracy_widget: "Accuracy",
};

function createIrlFieldWidgetItem(
  type: IrlFieldWidgetType,
  ctx: CreateRootItemContext
): OverlayItem {
  const id = ctx.nextId();
  const { w, h } = IRL_FIELD_WIDGET_DEFAULT_SIZE;
  const n = ctx.scene.items.filter((i) => i.type === type).length + 1;
  const fieldLabel = FIELD_LABELS[type];
  return {
    id,
    scene_id: ctx.scene.id,
    type,
    x: Math.round(ctx.scene.width / 2 - w / 2),
    y: Math.round(ctx.scene.height / 2 - h / 2),
    w,
    h,
    // New widgets are authored at their default size, so they start at scale 1.
    design_w: w,
    design_h: h,
    crop_top: 0,
    crop_right: 0,
    crop_bottom: 0,
    crop_left: 0,
    anchor_x: "left",
    anchor_y: "top",
    z_index: ctx.maxZ + 1,
    rotation: 0,
    flip_h: false,
    flip_v: false,
    opacity: 1,
    is_visible: true,
    is_locked: false,
    label: n === 1 ? `IRL ${fieldLabel}` : `IRL ${fieldLabel} ${n}`,
    config: { ...DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG },
  };
}

export function createIrlSpeedWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [createIrlFieldWidgetItem("irl_speed_widget", ctx)];
}

export function createIrlHeadingWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [createIrlFieldWidgetItem("irl_heading_widget", ctx)];
}

export function createIrlAltitudeWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [createIrlFieldWidgetItem("irl_altitude_widget", ctx)];
}

export function createIrlLatitudeWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [createIrlFieldWidgetItem("irl_latitude_widget", ctx)];
}

export function createIrlLongitudeWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [createIrlFieldWidgetItem("irl_longitude_widget", ctx)];
}

export function createIrlAccuracyWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [createIrlFieldWidgetItem("irl_accuracy_widget", ctx)];
}
