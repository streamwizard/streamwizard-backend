"use client";

import {
  FontWeightSelect,
  GoogleFontSelect,
  TextAlignSelect,
} from "@/components/overlays/inspector-fields";
import { ColorPicker } from "@repo/ui";
import { Label } from "@repo/ui";
import { Slider } from "@repo/ui";
import { Textarea } from "@repo/ui";
import {
  asTextWidgetConfig,
  resolvedTextWidgetFontFamily,
  type TextWidgetItemConfig,
} from "@/types/overlays";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

export function TextWidgetSettings({
  item,
  updateItem,
}: OverlayInspectorAppendProps) {
  const cfg = asTextWidgetConfig(item.config);
  const fontFamily = resolvedTextWidgetFontFamily(cfg);

  function patchConfig(updates: Partial<TextWidgetItemConfig>) {
    updateItem(item.id, {
      config: { ...cfg, ...updates },
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Text
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Content</Label>
            <Textarea
              value={cfg.text}
              onChange={(e) => patchConfig({ text: e.target.value })}
              className="min-h-[88px] text-sm resize-y"
              maxLength={5000}
            />
          </div>

          <GoogleFontSelect
            id="text-widget-font-family"
            value={fontFamily}
            onValueChange={(v) => patchConfig({ fontFamily: v })}
          />

          <div className="space-y-1.5">
            <Label className="text-xs">
              Font size ({Math.round(cfg.fontSize)}px)
            </Label>
            <Slider
              value={[cfg.fontSize]}
              onValueChange={([v]) =>
                patchConfig({ fontSize: Math.round(Math.max(8, Math.min(200, v))) })
              }
              min={8}
              max={120}
              step={1}
              className="py-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Color</Label>
              <ColorPicker
                value={cfg.color}
                onChange={(color) => patchConfig({ color })}
                aria-label="Text color"
              />
            </div>
            <FontWeightSelect
              id="text-widget-font-weight"
              className="min-w-0"
              triggerClassName="w-full"
              value={cfg.fontWeight}
              onValueChange={(v) => patchConfig({ fontWeight: v })}
            />
          </div>

          <TextAlignSelect
            id="text-widget-align"
            triggerClassName="w-full"
            value={cfg.align}
            onValueChange={(v) => patchConfig({ align: v })}
          />
        </div>
      </div>
    </div>
  );
}
