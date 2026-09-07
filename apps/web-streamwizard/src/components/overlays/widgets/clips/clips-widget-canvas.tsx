"use client";

import type {
  ClipDisplayFieldLayout,
  DisplayFieldKey,
} from "@/types/overlays";
import {
  asClipDisplayFieldConfig,
  buildCompositeClipsConfig,
  getClipDisplayChildren,
} from "@/types/overlays";
import type { OverlayCanvasProps } from "../../registry/overlay-widget-registry.types";
import { ClipVideoPreview } from "./clip-video-preview";

export function ClipsWidgetCanvas({
  item,
  scene,
  screenScale,
  selectedItemId,
  selected,
  selectItem,
  selectClipDisplayFieldForEdit,
  updateItem,
  editorClipPlayback,
}: OverlayCanvasProps) {
  const childOfThis =
    selected?.type === "clip_display_field" &&
    asClipDisplayFieldConfig(selected.config).parentClipItemId === item.id;
  const clipWidgetEditable =
    item.type === "clips_widget" && (selectedItemId === item.id || !!childOfThis);

  const selectedFieldKey: DisplayFieldKey | null =
    item.type === "clips_widget" &&
    selected?.type === "clip_display_field" &&
    asClipDisplayFieldConfig(selected.config).parentClipItemId === item.id
      ? asClipDisplayFieldConfig(selected.config).fieldKey
      : null;

  return (
    <ClipVideoPreview
      config={buildCompositeClipsConfig(item, scene.items)}
      screenScale={screenScale}
      editable={clipWidgetEditable}
      selectedFieldKey={selectedFieldKey}
      editorClipPlayback={editorClipPlayback}
      onSelectField={
        clipWidgetEditable
          ? (field) => {
              if (field) {
                selectClipDisplayFieldForEdit(item.id, field);
              } else {
                selectItem(item.id);
              }
            }
          : undefined
      }
      onUpdateDisplayFieldLayout={(
        field: DisplayFieldKey,
        layout: Partial<ClipDisplayFieldLayout>
      ) => {
        const child = getClipDisplayChildren(scene.items, item.id).find(
          (c) => asClipDisplayFieldConfig(c.config).fieldKey === field
        );
        if (!child) return;
        const fc = asClipDisplayFieldConfig(child.config);
        updateItem(child.id, {
          config: {
            ...fc,
            layout: { ...fc.layout, ...layout },
          },
        });
      }}
    />
  );
}
