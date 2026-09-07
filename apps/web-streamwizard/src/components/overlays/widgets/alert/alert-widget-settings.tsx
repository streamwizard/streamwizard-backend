"use client";

import { useState } from "react";
import { useDemoFire } from "@/hooks/overlays/use-demo-fire";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  ColorPicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Slider,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui";
import {
  ALERT_AMOUNT_LABELS,
  ALERT_DETAIL_TOKENS,
  ALERT_EVENT_CATEGORIES,
  ALERT_EVENT_LABELS,
  ALERT_GIFTER_EVENTS,
  ALERT_MESSAGE_EVENTS,
  ALERT_NAME_LABELS,
  ALERT_EVENT_SUBSCRIPTION_TYPES,
  normalizeAlertWidgetConfig,
  type AlertAnimationIn,
  type AlertAnimationOut,
  type AlertEventCategoryId,
  type AlertEventType,
  type AlertLayout,
  type AlertVariantConfig,
  type AlertWidgetItemConfig,
} from "@repo/ui/overlay";
import {
  FontWeightSelect,
  GoogleFontSelect,
  TextAlignSelect,
  GroupLabel,
  MediaField,
  SectionTitle,
} from "@/components/overlays/inspector-fields";
import {
  ANIMATION_IN_LABELS,
  ANIMATION_OUT_LABELS,
  LAYOUT_LABELS,
} from "./alert-widget-labels";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

export function AlertWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = normalizeAlertWidgetConfig(item.config);
  const [category, setCategory] = useState<AlertEventCategoryId>("community");
  // Which event is expanded, per tab -- switching tabs and coming back should
  // land where you left off rather than collapsing everything.
  const [openByCategory, setOpenByCategory] = useState<Record<string, string>>({
    community: "follow",
  });
  const [testBusy, setTestBusy] = useState<AlertEventType | null>(null);
  const { mode, fire } = useDemoFire();

  function patchConfig(updates: Partial<AlertWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  function patchVariant(event: AlertEventType, updates: Partial<AlertVariantConfig>) {
    patchConfig({
      variants: {
        ...cfg.variants,
        [event]: { ...cfg.variants[event], ...updates },
      },
    });
  }

  async function fireTest(event: AlertEventType) {
    // Same path the demo bar's buttons take, so Local/Live means the same thing
    // in both places and this panel needs no live switch of its own.
    // It warns on its own when nothing on the scene would play the alert, so a
    // switched-off one never reads as a broken button.
    setTestBusy(event);
    await fire(ALERT_EVENT_SUBSCRIPTION_TYPES[event]);
    setTestBusy(null);
  }

  return (
    <div className="space-y-5">
      {/* ── Per-event config ─────────────────────────────────── */}
      <div>
        <SectionTitle>Alert types</SectionTitle>
        <Tabs value={category} onValueChange={(v) => setCategory(v as AlertEventCategoryId)}>
          {/* Same grouping the public /overlays catalog uses, so the page a
              streamer read and the panel they configure line up. */}
          <TabsList className="w-full">
            {ALERT_EVENT_CATEGORIES.map((c) => (
              <TabsTrigger key={c.id} value={c.id} className="flex-1 text-xs">
                {c.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {ALERT_EVENT_CATEGORIES.map((c) => (
            <TabsContent key={c.id} value={c.id} className="mt-2">
              <Accordion
                type="single"
                collapsible
                value={openByCategory[c.id] ?? ""}
                onValueChange={(v) =>
                  setOpenByCategory((prev) => ({ ...prev, [c.id]: v }))
                }
                className="-mx-1"
              >
                {c.events.map((event) => {
                  const variant = cfg.variants[event];
                  const amountLabel = ALERT_AMOUNT_LABELS[event];
                  const detailToken = ALERT_DETAIL_TOKENS[event];
                  // A leftover "media" mode on an image or an empty slot has no
                  // video to match, so it reads (and behaves) as the fixed one.
                  const matchesVideo =
                    variant.mediaKind === "video" && variant.durationMode === "media";

                  return (
                    <AccordionItem key={event} value={event} className="border-b">
                      {/* Trigger spans the row so the chevron sits far right; the
                          test button (left) and toggle (right) float over it. */}
                      <div className="relative">
                        <AccordionTrigger className="w-full items-center gap-0 py-2 pl-16 pr-1 hover:no-underline">
                          <span className="flex flex-1 items-center gap-2 min-w-0 pr-16">
                            <span
                              className={
                                variant.enabled ? "truncate" : "truncate text-muted-foreground"
                              }
                            >
                              {ALERT_EVENT_LABELS[event]}
                            </span>
                            {!variant.enabled && (
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                                Off
                              </span>
                            )}
                          </span>
                        </AccordionTrigger>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-14 px-0 text-xs"
                          disabled={testBusy !== null}
                          onClick={() => void fireTest(event)}
                        >
                          {testBusy === event ? "…" : "Test"}
                        </Button>
                        <Switch
                          aria-label={`Enable ${ALERT_EVENT_LABELS[event]} alerts`}
                          className="absolute right-6 top-1/2 -translate-y-1/2"
                          checked={variant.enabled}
                          onCheckedChange={(v) => patchVariant(event, { enabled: v })}
                        />
                      </div>

                      <AccordionContent className="space-y-4 px-1 pb-5">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Title</Label>
                          <Input
                            value={variant.titleTemplate}
                            onChange={(e) =>
                              patchVariant(event, { titleTemplate: e.target.value })
                            }
                            className="h-9 text-sm"
                            maxLength={200}
                          />
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {"{name}"} is {ALERT_NAME_LABELS[event]}
                            {amountLabel ? `, {amount} is ${amountLabel}` : ""}
                            {ALERT_GIFTER_EVENTS.includes(event)
                              ? ", {gifter} is who gave the original sub"
                              : ""}
                            {detailToken === "reward" ? ", {reward} is the reward" : ""}
                            {detailToken === "charity" ? ", {charity} is the charity" : ""}.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">Second line (optional)</Label>
                          <Input
                            value={variant.messageTemplate}
                            onChange={(e) =>
                              patchVariant(event, { messageTemplate: e.target.value })
                            }
                            className="h-9 text-sm"
                            maxLength={200}
                            placeholder="Leave empty to hide"
                          />
                          {ALERT_MESSAGE_EVENTS.includes(event) && (
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              {"{message}"} shows what the viewer wrote.
                            </p>
                          )}
                        </div>

                        <MediaField
                          label="Image or video"
                          kinds={["image", "video"]}
                          value={variant.mediaUrl}
                          helper="Transparent WebM and GIFs work great."
                          onChange={(url, kind) =>
                            patchVariant(event, {
                              mediaUrl: url,
                              mediaKind:
                                kind === "video" ? "video" : kind === "image" ? "image" : "",
                            })
                          }
                        />

                        <MediaField
                          label="Sound"
                          kinds={["audio"]}
                          value={variant.soundUrl}
                          onChange={(url) => patchVariant(event, { soundUrl: url })}
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">
                              Volume ({Math.round(variant.volume * 100)}%)
                            </Label>
                            <Slider
                              value={[variant.volume]}
                              onValueChange={([v]) => patchVariant(event, { volume: v })}
                              min={0}
                              max={1}
                              step={0.05}
                              className="py-1"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">
                              On screen{" "}
                              {matchesVideo
                                ? "(video length)"
                                : `(${variant.durationSeconds}s)`}
                            </Label>
                            <Slider
                              value={[variant.durationSeconds]}
                              onValueChange={([v]) =>
                                patchVariant(event, { durationSeconds: Math.round(v) })
                              }
                              min={1}
                              max={30}
                              step={1}
                              disabled={matchesVideo}
                              className="py-1"
                            />
                          </div>
                        </div>

                        {variant.mediaKind === "video" && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <Label
                                htmlFor={`alert-duration-mode-${event}`}
                                className="text-xs cursor-pointer"
                              >
                                Match the video length
                              </Label>
                              <Switch
                                id={`alert-duration-mode-${event}`}
                                checked={matchesVideo}
                                onCheckedChange={(v) =>
                                  patchVariant(event, {
                                    durationMode: v ? "media" : "fixed",
                                  })
                                }
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              Plays the video once and leaves when it ends, instead of
                              looping for a set time. Long videos get cut at 60s.
                            </p>
                          </div>
                        )}

                        {amountLabel && (
                          <div className="space-y-1.5">
                            <Label className="text-xs">Minimum {amountLabel}</Label>
                            <Input
                              type="number"
                              min={0}
                              value={variant.minAmount}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (!Number.isFinite(n)) return;
                                patchVariant(event, { minAmount: Math.max(0, Math.round(n)) });
                              }}
                              className="h-9 text-sm"
                            />
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              Alerts below this are skipped. 0 shows everything.
                            </p>
                          </div>
                        )}

                        <GroupLabel>Look &amp; feel</GroupLabel>

                        <div className="space-y-1.5">
                          <Label className="text-xs">Layout</Label>
                          <Select
                            value={variant.layout}
                            onValueChange={(v) =>
                              patchVariant(event, { layout: v as AlertLayout })
                            }
                          >
                            <SelectTrigger className="h-9 text-sm w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(LAYOUT_LABELS) as AlertLayout[]).map((l) => (
                                <SelectItem key={l} value={l} className="text-sm">
                                  {LAYOUT_LABELS[l]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Entrance</Label>
                            <Select
                              value={variant.animationIn}
                              onValueChange={(v) =>
                                patchVariant(event, { animationIn: v as AlertAnimationIn })
                              }
                            >
                              <SelectTrigger className="h-9 text-sm w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(ANIMATION_IN_LABELS) as AlertAnimationIn[]).map(
                                  (a) => (
                                    <SelectItem key={a} value={a} className="text-sm">
                                      {ANIMATION_IN_LABELS[a]}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Exit</Label>
                            <Select
                              value={variant.animationOut}
                              onValueChange={(v) =>
                                patchVariant(event, { animationOut: v as AlertAnimationOut })
                              }
                            >
                              <SelectTrigger className="h-9 text-sm w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(ANIMATION_OUT_LABELS) as AlertAnimationOut[]).map(
                                  (a) => (
                                    <SelectItem key={a} value={a} className="text-sm">
                                      {ANIMATION_OUT_LABELS[a]}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <GoogleFontSelect
                          id={`alert-font-family-${event}`}
                          value={variant.fontFamily}
                          onValueChange={(v) => patchVariant(event, { fontFamily: v })}
                        />

                        <div className="space-y-1.5">
                          <Label className="text-xs">Font size ({variant.fontSize}px)</Label>
                          <Slider
                            value={[variant.fontSize]}
                            onValueChange={([v]) =>
                              patchVariant(event, { fontSize: Math.round(v) })
                            }
                            min={12}
                            max={96}
                            step={1}
                            className="py-1"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <FontWeightSelect
                            id={`alert-font-weight-${event}`}
                            className="min-w-0"
                            triggerClassName="w-full"
                            value={variant.fontWeight}
                            onValueChange={(v) => patchVariant(event, { fontWeight: v })}
                          />
                          <TextAlignSelect
                            id={`alert-align-${event}`}
                            className="min-w-0"
                            triggerClassName="w-full"
                            value={variant.align}
                            onValueChange={(v) => patchVariant(event, { align: v })}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Title</Label>
                            <ColorPicker
                              value={variant.titleColor}
                              onChange={(titleColor) => patchVariant(event, { titleColor })}
                              aria-label="Title color"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Accent</Label>
                            <ColorPicker
                              value={variant.accentColor}
                              fallback="#9e7aff"
                              onChange={(accentColor) => patchVariant(event, { accentColor })}
                              aria-label="Accent color"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Message</Label>
                            <ColorPicker
                              value={variant.messageColor}
                              fallback="#d4d4d8"
                              onChange={(messageColor) => patchVariant(event, { messageColor })}
                              aria-label="Message color"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Accent highlights {"{name}"} and {"{amount}"} in the title.
                        </p>

                        <div className="flex items-center justify-between gap-2">
                          <Label
                            htmlFor={`alert-text-shadow-${event}`}
                            className="text-xs cursor-pointer"
                          >
                            Text shadow for readability
                          </Label>
                          <Switch
                            id={`alert-text-shadow-${event}`}
                            checked={variant.textShadow}
                            onCheckedChange={(v) => patchVariant(event, { textShadow: v })}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <Separator />

      {/* ── Everything-alerts settings ───────────────────────── */}
      <div>
        <SectionTitle>All alerts</SectionTitle>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Master volume ({Math.round(cfg.masterVolume * 100)}%)
            </Label>
            <Slider
              value={[cfg.masterVolume]}
              onValueChange={([v]) => patchConfig({ masterVolume: v })}
              min={0}
              max={1}
              step={0.05}
              className="py-1"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Gap between alerts ({cfg.gapSeconds}s)</Label>
            <Slider
              value={[cfg.gapSeconds]}
              onValueChange={([v]) => patchConfig({ gapSeconds: Math.round(v) })}
              min={0}
              max={10}
              step={1}
              className="py-1"
            />
          </div>

          {/* No live switch here: the demo bar owns it for the whole editor, so
              there is one answer to "where do my tests go" instead of two. */}
          <div className="min-w-0">
            <Label className="text-xs">Where tests go</Label>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {mode === "live"
                ? "Live. Tests play on this canvas and in OBS, exactly like the real thing."
                : "This canvas only. Switch the demo bar to Live to fire them in OBS too."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
