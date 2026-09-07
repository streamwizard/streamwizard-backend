"use client";

import {
  FontWeightSelect,
  GoogleFontSelect,
  TextAlignSelect,
} from "@/components/overlays/inspector-fields";
import { ColorPicker } from "@repo/ui";
import { Input } from "@repo/ui";
import { Label } from "@repo/ui";
import { RadioGroup, RadioGroupItem } from "@repo/ui";
import { Slider } from "@repo/ui";
import { Switch } from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import type {
  ClockDateStyle,
  ClockLayoutMode,
  ClockTimeStyle,
  ClockWidgetItemConfig,
} from "@/types/overlays";
import {
  normalizeClockWidgetConfig,
  resolvedTextWidgetFontFamily,
} from "@/types/overlays";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

export function ClockWidgetSettings({
  item,
  updateItem,
}: OverlayInspectorAppendProps) {
  const cfg = normalizeClockWidgetConfig(item.config);
  const fontFamily = resolvedTextWidgetFontFamily(cfg);

  function patchConfig(updates: Partial<ClockWidgetItemConfig>) {
    updateItem(item.id, {
      config: { ...cfg, ...updates },
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Date &amp; time
        </h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Time zone</Label>
            <Input
              value={cfg.timeZone}
              onChange={(e) => patchConfig({ timeZone: e.target.value })}
              className="h-9 text-sm font-mono"
              placeholder="Empty = viewer local"
              maxLength={100}
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              IANA name (e.g. Europe/Amsterdam). Leave empty so each viewer sees
              their own local time.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Show date</Label>
              <Switch
                checked={cfg.showDate}
                onCheckedChange={(v) => patchConfig({ showDate: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Show time</Label>
              <Switch
                checked={cfg.showTime}
                onCheckedChange={(v) => patchConfig({ showTime: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">12-hour clock</Label>
              <Switch
                checked={cfg.hour12}
                onCheckedChange={(v) => patchConfig({ hour12: v })}
                disabled={!cfg.showTime}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Show seconds</Label>
              <Switch
                checked={cfg.showSeconds}
                onCheckedChange={(v) => patchConfig({ showSeconds: v })}
                disabled={!cfg.showTime}
              />
            </div>
          </div>

          {cfg.showDate ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Date style</Label>
              <Select
                value={cfg.dateStyle}
                onValueChange={(v) =>
                  patchConfig({ dateStyle: v as ClockDateStyle })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {cfg.showTime ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Time style</Label>
              <Select
                value={cfg.timeStyle}
                onValueChange={(v) =>
                  patchConfig({ timeStyle: v as ClockTimeStyle })
                }
                disabled={cfg.showSeconds}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
              {cfg.showSeconds ? (
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Seconds use a medium-length time pattern in the browser.
                </p>
              ) : null}
            </div>
          ) : null}

          {cfg.showDate && cfg.showTime ? (
            <div className="space-y-2">
              <Label className="text-xs">Layout</Label>
              <RadioGroup
                value={cfg.layout}
                onValueChange={(v) =>
                  patchConfig({ layout: v as ClockLayoutMode })
                }
                className="gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="inline" id="clock-layout-inline" />
                  <Label
                    htmlFor="clock-layout-inline"
                    className="text-xs font-normal cursor-pointer"
                  >
                    One line
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="stacked" id="clock-layout-stacked" />
                  <Label
                    htmlFor="clock-layout-stacked"
                    className="text-xs font-normal cursor-pointer"
                  >
                    Date above time
                  </Label>
                </div>
              </RadioGroup>
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Text style
        </h3>
        <div className="space-y-3">
          <GoogleFontSelect
            id="clock-widget-font-family"
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
                patchConfig({
                  fontSize: Math.round(Math.max(8, Math.min(200, v ?? 24))),
                })
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
              id="clock-widget-font-weight"
              className="min-w-0"
              triggerClassName="w-full"
              value={cfg.fontWeight}
              onValueChange={(v) => patchConfig({ fontWeight: v })}
            />
          </div>

          <TextAlignSelect
            id="clock-widget-align"
            triggerClassName="w-full"
            value={cfg.align}
            onValueChange={(v) => patchConfig({ align: v })}
          />
        </div>
      </div>
    </div>
  );
}
