"use client";

import { BLEND_MODES, MIN_CLIP_MS, TEXT_PRESETS, findClip, type BlendMode, type Clip, type ClipEffects, type TextPreset, type TextSource } from "@repo/alert-scene";
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider } from "@repo/ui";
import { NumberField } from "@/components/overlays/editor/number-field";
import { InspectorSection } from "@/components/overlays/editor/inspector-section";
import { updateClipCommand } from "../commands";
import { useTimelineStoreApi } from "../timeline-context";
import { ColourRow, Field, SwitchRow, Unit } from "./field-chrome";

const BLEND_LABELS: Record<BlendMode, string> = {
  normal: "Normal",
  multiply: "Multiply",
  screen: "Screen",
  overlay: "Overlay",
  lighten: "Lighten",
  darken: "Darken",
  difference: "Difference",
};

const PRESET_LABELS: Record<TextPreset, string> = {
  none: "None",
  typewriter: "Typewriter",
  stagger: "Letter by letter",
};

/** What switching an effect on starts from; visible at once, easy to tune. */
const DEFAULT_SHADOW = { x: 0, y: 4, blur: 12, color: "#000000" };
const DEFAULT_TINT = { color: "#9e7aff", amount: 0.5 };

function SliderRow({ id, label, value, min, max, step, unit, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5" data-field={label.toLowerCase()}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-[11px] text-muted-foreground">
          {label}
        </Label>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {Math.round(value)}
          {unit}
        </span>
      </div>
      <Slider id={id} value={[value]} min={min} max={max} step={step} onValueChange={([v]) => v !== undefined && onChange(v)} aria-label={label} className="py-1" />
    </div>
  );
}

/**
 * How the text arrives and leaves: a preset and its length, one pair for in
 * (from the clip start) and one for out (to the clip end). Text clips only;
 * the fields live on the text source and paint from the clip's local time.
 */
function TextAnimationFields({ clip, src }: { clip: Clip; src: TextSource }) {
  const api = useTimelineStoreApi();
  const length = clip.end - clip.start;
  const patch = (p: Partial<TextSource>, key: string, label: string) => {
    const s = api.getState();
    const loc = findClip(s.scene, clip.id);
    if (!loc || loc.clip.source.kind !== "text") return;
    const cmd = updateClipCommand(s.scene, clip.id, { source: { ...loc.clip.source, ...p } }, `src:${clip.id}:${key}`, label);
    if (cmd) s.execute(cmd);
  };
  const clampMs = (seconds: number) => Math.min(length, Math.max(MIN_CLIP_MS, Math.round(seconds * 1000)));
  const pair = (
    side: "in" | "out",
    preset: TextPreset,
    durationMs: number,
    onPreset: (p: TextPreset) => void,
    onDuration: (ms: number) => void
  ) => {
    const title = side === "in" ? "Animate in" : "Animate out";
    return (
      <div className="grid grid-cols-2 gap-2">
        <Field label={title}>
          <Select value={preset} onValueChange={(v) => onPreset(v as TextPreset)}>
            <SelectTrigger className="h-8 text-xs" aria-label={title}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEXT_PRESETS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRESET_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {preset !== "none" && (
          <Field label="Length">
            <NumberField
              value={Math.min(durationMs, length) / 1000}
              min={MIN_CLIP_MS / 1000}
              max={length / 1000}
              onCommit={(v) => onDuration(clampMs(v))}
              className="pr-8"
              adornment={<Unit>s</Unit>}
            />
          </Field>
        )}
      </div>
    );
  };
  return (
    <>
      {pair(
        "in",
        src.preset,
        src.presetDurationMs,
        (preset) => patch({ preset }, "preset", "Set animate in"),
        (presetDurationMs) => patch({ presetDurationMs }, "presetDuration", "Set animate in length")
      )}
      {pair(
        "out",
        src.presetOut,
        src.presetOutDurationMs,
        (presetOut) => patch({ presetOut }, "presetOut", "Set animate out"),
        (presetOutDurationMs) => patch({ presetOutDurationMs }, "presetOutDuration", "Set animate out length")
      )}
    </>
  );
}

/**
 * Per-clip effects: how text animates in and out, then the static look
 * (blend, drop shadow, blur, tint). Nothing here has a stopwatch; a slider
 * drag coalesces into one undo step through its key.
 */
export function EffectsSection({ clip }: { clip: Clip }) {
  const api = useTimelineStoreApi();
  const fx = clip.effects;

  // Read the committed effects at write time: a slider fires faster than the
  // inspector re-renders, and each step must build on the last.
  const set = (patch: Partial<ClipEffects>, key: string, label: string) => {
    const s = api.getState();
    const loc = findClip(s.scene, clip.id);
    if (!loc) return;
    const cmd = updateClipCommand(s.scene, clip.id, { effects: { ...loc.clip.effects, ...patch } }, `fx:${clip.id}:${key}`, label);
    if (cmd) s.execute(cmd);
  };

  const textShadowToo = clip.source.kind === "text" && clip.source.shadow && fx.shadow !== null;

  return (
    <InspectorSection title="Effects" defaultOpen={false}>
      <div className="space-y-3">
        {clip.source.kind === "text" && <TextAnimationFields clip={clip} src={clip.source} />}
        <Field label="Blend mode">
          <Select value={fx.blendMode} onValueChange={(v) => set({ blendMode: v as BlendMode }, "blend", "Set blend mode")}>
            <SelectTrigger className="h-8 text-xs" aria-label="Blend mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BLEND_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {BLEND_LABELS[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <SwitchRow
          id={`fx-shadow-${clip.id}`}
          label="Shadow"
          checked={fx.shadow !== null}
          onCheckedChange={(on) => set({ shadow: on ? DEFAULT_SHADOW : null }, "shadow", on ? "Add shadow" : "Remove shadow")}
          helper={textShadowToo ? "Stacks on the Text shadow. Turn that off for a clean drop shadow." : undefined}
        />
        {fx.shadow && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <Field label="X">
                <NumberField value={fx.shadow.x} min={-200} max={200} onCommit={(v) => set({ shadow: { ...fx.shadow!, x: Math.round(v) } }, "shadow-x", "Set shadow")} className="pr-8" adornment={<Unit>px</Unit>} />
              </Field>
              <Field label="Y">
                <NumberField value={fx.shadow.y} min={-200} max={200} onCommit={(v) => set({ shadow: { ...fx.shadow!, y: Math.round(v) } }, "shadow-y", "Set shadow")} className="pr-8" adornment={<Unit>px</Unit>} />
              </Field>
              <Field label="Blur">
                <NumberField value={fx.shadow.blur} min={0} max={200} onCommit={(v) => set({ shadow: { ...fx.shadow!, blur: Math.round(v) } }, "shadow-blur", "Set shadow")} className="pr-8" adornment={<Unit>px</Unit>} />
              </Field>
            </div>
            <ColourRow label="Shadow" value={fx.shadow.color} onChange={(color) => set({ shadow: { ...fx.shadow!, color } }, "shadow-color", "Set shadow colour")} />
          </div>
        )}

        <SliderRow id={`fx-blur-${clip.id}`} label="Blur" value={fx.blur} min={0} max={100} step={1} unit=" px" onChange={(blur) => set({ blur }, "blur", "Set blur")} />

        <SwitchRow
          id={`fx-tint-${clip.id}`}
          label="Tint"
          checked={fx.tint !== null}
          onCheckedChange={(on) => set({ tint: on ? DEFAULT_TINT : null }, "tint", on ? "Add tint" : "Remove tint")}
        />
        {fx.tint && (
          <div className="space-y-2">
            <ColourRow label="Tint" value={fx.tint.color} onChange={(color) => set({ tint: { ...fx.tint!, color } }, "tint-color", "Set tint colour")} />
            <SliderRow
              id={`fx-tint-amount-${clip.id}`}
              label="Amount"
              value={fx.tint.amount * 100}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(v) => set({ tint: { ...fx.tint!, amount: v / 100 } }, "tint-amount", "Set tint")}
            />
          </div>
        )}
      </div>
    </InspectorSection>
  );
}
