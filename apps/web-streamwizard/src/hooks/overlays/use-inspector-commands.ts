"use client";

import {
  clampCrop,
  clampScale,
  getCropInsets,
  getDesignSize,
  getItemScale,
  hasCrop,
  type CropInsets,
} from "@repo/ui/overlay";
import type { OverlayItem, OverlaySceneWithItems } from "@/types/overlays";
import { asClipDisplayFieldConfig } from "@/types/overlays";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import {
  pinToSceneEdge,
  reanchorInPlace,
  type SceneEdge,
} from "@/components/overlays/editor/overlay-item-helpers";

export type AlignEdge = SceneEdge;
export type FitMode = "scene" | "width" | "height";

/**
 * The numeric side of the inspector: scale, crop, design box, fit and align.
 * Split out so the panel component is layout only — the maths is testable and
 * readable without wading through 400 lines of form markup.
 */
export function useInspectorCommands(item: OverlayItem, scene: OverlaySceneWithItems | null) {
  const updateItem = useOverlayStore((s) => s.updateItem);

  const sceneW = scene?.width ?? 1920;
  const sceneH = scene?.height ?? 1080;

  const designSize = getDesignSize(item);
  const itemScale = getItemScale(item);
  const cropInsets = getCropInsets(item);
  const isCropped = hasCrop(item);

  function handleUpdate(updates: Partial<OverlayItem>) {
    updateItem(item.id, updates);
  }

  /** Resize the whole widget, contents included. */
  function setScale(next: number) {
    const scale = clampScale(next);
    handleUpdate({
      w: Math.round(designSize.w * scale),
      h: Math.round(designSize.h * scale),
    });
  }

  function setScalePercent(percent: number) {
    if (!Number.isFinite(percent) || percent <= 0) return;
    setScale(percent / 100);
  }

  function setRenderedWidth(w: number) {
    if (!Number.isFinite(w) || w <= 0) return;
    setScale(w / designSize.w);
  }

  function setRenderedHeight(h: number) {
    if (!Number.isFinite(h) || h <= 0) return;
    setScale(h / designSize.h);
  }

  function applyCrop(next: CropInsets) {
    handleUpdate({
      crop_top: next.top,
      crop_right: next.right,
      crop_bottom: next.bottom,
      crop_left: next.left,
      w: Math.round((designSize.w - next.left - next.right) * itemScale),
      h: Math.round((designSize.h - next.top - next.bottom) * itemScale),
    });
  }

  /**
   * Crop hides part of the content and shrinks the box to match, leaving the
   * scale alone. Stretch the box back out afterwards and you have zoomed in
   * without the widget ever leaving the canvas.
   */
  function setCropInset(edge: keyof CropInsets, value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    applyCrop(clampCrop({ ...cropInsets, [edge]: value }, designSize));
  }

  /** Resize the layout box without touching how big the content renders. */
  function setDesignWidth(designW: number) {
    if (!Number.isFinite(designW) || designW <= 0) return;
    handleUpdate({ design_w: designW, w: Math.round(designW * itemScale) });
  }

  function setDesignHeight(designH: number) {
    if (!Number.isFinite(designH) || designH <= 0) return;
    handleUpdate({ design_h: designH, h: Math.round(designH * itemScale) });
  }

  /** Geometry targets the clips widget when a nested display field is selected. */
  const layoutTarget: OverlayItem =
    item.type === "clip_display_field"
      ? (scene?.items.find((i) => i.id === asClipDisplayFieldConfig(item.config).parentClipItemId) ??
        item)
      : item;

  const layoutLocked = layoutTarget.is_locked;

  /**
   * Fitting scales the widget rather than stretching its frame, so a widget
   * fitted to the scene keeps its proportions instead of distorting.
   */
  function scaleLayoutTarget(scale: number, position: Partial<OverlayItem>) {
    if (layoutLocked) return;
    const design = getDesignSize(layoutTarget);
    const s = clampScale(scale);
    updateItem(layoutTarget.id, {
      ...position,
      w: Math.round(design.w * s),
      h: Math.round(design.h * s),
    });
  }

  function fit(mode: FitMode) {
    const design = getDesignSize(layoutTarget);
    if (mode === "scene") {
      scaleLayoutTarget(Math.min(sceneW / design.w, sceneH / design.h), { x: 0, y: 0 });
    } else if (mode === "width") {
      scaleLayoutTarget(sceneW / design.w, { x: 0 });
    } else {
      scaleLayoutTarget(sceneH / design.h, { y: 0 });
    }
  }

  /**
   * Pins the widget to a scene edge. This moves the anchor rather than the
   * offset, so the widget stays on that edge when the scene's resolution
   * changes instead of being left wherever the old edge used to be.
   */
  function align(edge: AlignEdge) {
    if (layoutLocked) return;
    updateItem(layoutTarget.id, pinToSceneEdge(edge));
  }

  /**
   * Changes which edge the widget is measured from without moving it. The X/Y
   * fields re-read as distances from the new edge; the canvas does not change.
   */
  function setAnchor(anchor: Partial<Pick<OverlayItem, "anchor_x" | "anchor_y">>) {
    if (layoutLocked) return;
    updateItem(
      layoutTarget.id,
      reanchorInPlace(layoutTarget, anchor, { width: sceneW, height: sceneH })
    );
  }

  return {
    sceneW,
    sceneH,
    designSize,
    itemScale,
    cropInsets,
    isCropped,
    layoutTarget,
    layoutLocked,
    handleUpdate,
    setScale,
    setScalePercent,
    setRenderedWidth,
    setRenderedHeight,
    setCropInset,
    applyCrop,
    setDesignWidth,
    setDesignHeight,
    fit,
    align,
    setAnchor,
  };
}
