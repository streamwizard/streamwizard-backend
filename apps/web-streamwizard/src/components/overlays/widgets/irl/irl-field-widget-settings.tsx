"use client";

import {
  FontWeightSelect,
  GoogleFontSelect,
  TextAlignSelect,
} from "@/components/overlays/inspector-fields";
import { ColorPicker, Label, Slider, Switch } from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { resolvedTextWidgetFontFamily } from "@/types/overlays";
import type { IrlFieldWidgetItemConfig } from "@/types/overlays";
import { DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG } from "@repo/ui/overlay";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

function resolveConfig(raw: unknown): IrlFieldWidgetItemConfig {
  const r = raw as Partial<IrlFieldWidgetItemConfig>;
  const base = DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG;
  return {
    unit: r.unit === "mph" ? "mph" : "kmh",
    mockData: typeof r.mockData === "boolean" ? r.mockData : base.mockData,
    fontSize: typeof r.fontSize === "number" && r.fontSize >= 8 ? r.fontSize : base.fontSize,
    color: typeof r.color === "string" ? r.color : base.color,
    align: r.align === "left" || r.align === "center" || r.align === "right" ? r.align : base.align,
    fontWeight:
      r.fontWeight === 400 || r.fontWeight === 500 || r.fontWeight === 600 || r.fontWeight === 700
        ? r.fontWeight
        : base.fontWeight,
    fontFamily: resolvedTextWidgetFontFamily(r),
  };
}

export function IrlFieldWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = resolveConfig(item.config);

  function patchConfig(updates: Partial<IrlFieldWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  const isSpeedWidget = item.type === "irl_speed_widget";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2.5">
        <div>
          <Label className="text-xs">Mock data</Label>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            Show sample values for layout design.
          </p>
        </div>
        <Switch
          checked={cfg.mockData}
          onCheckedChange={(v) => patchConfig({ mockData: v })}
        />
      </div>

      {isSpeedWidget && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Source
          </h3>
          <div className="space-y-1.5">
            <Label className="text-xs">Speed unit</Label>
            <Select
              value={cfg.unit}
              onValueChange={(v) => patchConfig({ unit: v as "kmh" | "mph" })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kmh">km/h</SelectItem>
                <SelectItem value="mph">mph</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Typography
        </h3>
        <div className="space-y-3">
          <GoogleFontSelect
            id={`irl-field-font-family-${item.id}`}
            value={resolvedTextWidgetFontFamily(cfg)}
            onValueChange={(v) => patchConfig({ fontFamily: v })}
          />

          <div className="space-y-1.5">
            <Label className="text-xs">Font size ({Math.round(cfg.fontSize)}px)</Label>
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
              id={`irl-field-font-weight-${item.id}`}
              className="min-w-0"
              triggerClassName="w-full"
              value={cfg.fontWeight}
              onValueChange={(v) => patchConfig({ fontWeight: v })}
            />
          </div>

          <TextAlignSelect
            id={`irl-field-align-${item.id}`}
            triggerClassName="w-full"
            value={cfg.align}
            onValueChange={(v) => patchConfig({ align: v })}
          />
        </div>
      </div>
    </div>
  );
}
