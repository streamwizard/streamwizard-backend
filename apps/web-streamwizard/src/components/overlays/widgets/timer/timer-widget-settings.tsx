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
import {
  normalizeTimerWidgetConfig,
  resolvedTextWidgetFontFamily,
  type TimerCountdownMode,
  type TimerWidgetItemConfig,
} from "@/types/overlays";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TimerWidgetSettings({
  item,
  updateItem,
}: OverlayInspectorAppendProps) {
  const cfg = normalizeTimerWidgetConfig(item.config);
  const fontFamily = resolvedTextWidgetFontFamily(cfg);

  function patchConfig(updates: Partial<TimerWidgetItemConfig>) {
    updateItem(item.id, {
      config: { ...cfg, ...updates },
    });
  }

  const minutesShown = Math.max(1, Math.round(cfg.durationSeconds / 60));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Countdown
        </h3>
        <div className="space-y-4">
          <RadioGroup
            value={cfg.countdownMode}
            onValueChange={(v) =>
              patchConfig({ countdownMode: v as TimerCountdownMode })
            }
            className="gap-3"
          >
            <div className="flex items-start gap-2.5">
              <RadioGroupItem value="duration" id="timer-mode-duration" className="mt-0.5" />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="timer-mode-duration" className="text-xs font-normal cursor-pointer">
                  After overlay loads
                </Label>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Count down a fixed length each time the page opens (good for
                  starting soon).
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <RadioGroupItem value="absolute" id="timer-mode-absolute" className="mt-0.5" />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="timer-mode-absolute" className="text-xs font-normal cursor-pointer">
                  Until date and time
                </Label>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Same countdown for every viewer (fixed stream start).
                </p>
              </div>
            </div>
          </RadioGroup>

          {cfg.countdownMode === "duration" ? (
            <div className="space-y-1.5 pl-1">
              <Label className="text-xs">Minutes</Label>
              <Input
                type="number"
                min={1}
                max={10080}
                step={1}
                value={minutesShown}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  if (!Number.isFinite(m)) return;
                  const sec = Math.round(
                    Math.max(60, Math.min(604800, m * 60))
                  );
                  patchConfig({ durationSeconds: sec });
                }}
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground leading-snug">
                Between 1 minute and 7 days; timer restarts when the overlay
                reloads.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 pl-1">
              <Label className="text-xs">Target date and time</Label>
              <Input
                type="datetime-local"
                value={isoToDatetimeLocalValue(cfg.targetAtIso)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  const iso = new Date(v).toISOString();
                  patchConfig({ targetAtIso: iso });
                }}
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground leading-snug">
                Pick date and time in your timezone; the saved moment is
                absolute for all viewers.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">When time is up</Label>
            <Input
              value={cfg.finishedText}
              onChange={(e) => patchConfig({ finishedText: e.target.value })}
              className="h-9 text-sm"
              maxLength={200}
              placeholder="We're live!"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Text style
        </h3>
        <div className="space-y-3">
          <GoogleFontSelect
            id="timer-widget-font-family"
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
              id="timer-widget-font-weight"
              className="min-w-0"
              triggerClassName="w-full"
              value={cfg.fontWeight}
              onValueChange={(v) => patchConfig({ fontWeight: v })}
            />
          </div>

          <TextAlignSelect
            id="timer-widget-align"
            triggerClassName="w-full"
            value={cfg.align}
            onValueChange={(v) => patchConfig({ align: v })}
          />
        </div>
      </div>
    </div>
  );
}
