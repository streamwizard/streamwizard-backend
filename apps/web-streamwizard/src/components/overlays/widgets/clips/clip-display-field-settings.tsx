"use client";

import { Button } from "@repo/ui";
import { ChevronLeft } from "lucide-react";
import { asClipDisplayFieldConfig } from "@/types/overlays";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import {
  ClipDisplayFieldInspector,
  getDefaultLayoutForField,
} from "./nested-fields";

export function ClipDisplayFieldSettings({
  item,
  updateItem,
}: OverlayInspectorAppendProps) {
  const { selectItem } = useOverlayStore();
  const fc = asClipDisplayFieldConfig(item.config);
  const parentId = fc.parentClipItemId;

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 -ml-2 text-muted-foreground"
        type="button"
        onClick={() => selectItem(parentId)}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to widget
      </Button>

      <ClipDisplayFieldInspector
        field={fc.fieldKey}
        layout={fc.layout}
        layoutLocked={fc.isLayoutLocked}
        onUpdateLayout={(patch) =>
          updateItem(item.id, {
            config: {
              ...fc,
              layout: { ...fc.layout, ...patch },
            },
          })
        }
        onResetLayout={() =>
          updateItem(item.id, {
            config: {
              ...fc,
              layout: getDefaultLayoutForField(fc.fieldKey),
            },
          })
        }
      />
    </div>
  );
}
