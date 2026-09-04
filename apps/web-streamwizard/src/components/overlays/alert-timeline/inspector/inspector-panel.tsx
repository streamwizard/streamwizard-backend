"use client";

import { findClip, type Clip, type ClipSource, type PropName } from "@repo/alert-scene";
import { ALERT_TEMPLATE_TOKENS } from "@repo/ui/overlay";
import { Link2, Unlink2 } from "lucide-react";
import { Button, ColorPicker, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea, Tooltip, TooltipContent, TooltipTrigger, cn } from "@repo/ui";
import { NumberField } from "@/components/overlays/editor/number-field";
import { InspectorSection } from "@/components/overlays/editor/inspector-section";
import { FontWeightSelect, GoogleFontSelect, MediaField, SectionTitle, TextAlignSelect } from "@/components/overlays/inspector-fields";
import { AnchorPicker } from "@/components/overlays/editor/anchor-picker";
import { anchorIsOnCell, anchorToCell, cellToAnchor, nodeBoxAt, reanchorNode } from "../anchor-math";
import { setBasePropCommand, setSceneMetaCommand, trimClipCommand, updateClipCommand, writePropsCommand, type Command } from "../commands";
import { valueAt } from "../prop-writer";
import { useTimeline, useTimelineStoreApi } from "../timeline-context";
import { visibleScene } from "../timeline-store";
import { clampClipTrim, neighboursOf } from "../timeline/timeline-math";
import { MAX_SCENE_DURATION_MS, MAX_SCENE_SIZE, MIN_SCENE_DURATION_MS } from "@repo/alert-scene";
import { AnimatableField } from "./animatable-field";
import { Field, Unit } from "./field-chrome";
import { KeyframeSection } from "./keyframe-section";

function SceneSection() {
  const api = useTimelineStoreApi();
  const scene = useTimeline((s) => s.scene);
  const patch = (p: Parameters<typeof setSceneMetaCommand>[1], key: string) => {
    const s = api.getState();
    s.execute(setSceneMetaCommand(s.scene, p, `scene:${key}`));
  };
  return (
    <InspectorSection title="Scene" defaultOpen>
      <div className="space-y-3">
        <Field label="Name">
          <Input value={scene.name} onChange={(e) => patch({ name: e.target.value.slice(0, 100) }, "name")} className="h-8 text-xs" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width">
            <NumberField value={scene.width} min={1} max={MAX_SCENE_SIZE} onCommit={(v) => patch({ width: Math.round(v) }, "width")} className="pr-8" adornment={<Unit>px</Unit>} />
          </Field>
          <Field label="Height">
            <NumberField value={scene.height} min={1} max={MAX_SCENE_SIZE} onCommit={(v) => patch({ height: Math.round(v) }, "height")} className="pr-8" adornment={<Unit>px</Unit>} />
          </Field>
        </div>
        <Field label="Duration">
          <NumberField
            value={Math.round(scene.duration) / 1000}
            min={MIN_SCENE_DURATION_MS / 1000}
            max={MAX_SCENE_DURATION_MS / 1000}
            onCommit={(v) => patch({ duration: Math.round(v * 1000) }, "duration")}
            className="pr-8" adornment={<Unit>s</Unit>}
          />
        </Field>
      </div>
    </InspectorSection>
  );
}

/** Keeps focus where it was so Space and arrows still hit the timeline. */
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

function UniformScaleLock() {
  const api = useTimelineStoreApi();
  const uniform = useTimeline((s) => s.uniformScale);
  const label = uniform ? "Scale both axes together" : "Scale each axis on its own";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={uniform}
          onMouseDown={keepFocus}
          onClick={() => api.getState().setUniformScale(!uniform)}
          className={cn(
            "flex size-5 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            uniform && "text-primary hover:text-primary"
          )}
        >
          {uniform ? <Link2 className="size-3.5" /> : <Unlink2 className="size-3.5" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function TransformSection({ clip }: { clip: Clip }) {
  const api = useTimelineStoreApi();
  const uniform = useTimeline((s) => s.uniformScale);
  const setStatic = (prop: PropName, value: number) => {
    const s = api.getState();
    const cmd = setBasePropCommand(s.scene, clip.id, prop, value, `base:${clip.id}:${prop}`);
    if (cmd) s.execute(cmd);
  };
  const scaleBoth = uniform
    ? (scene: Parameters<typeof writePropsCommand>[0], value: number, playhead: number, key: string) =>
        writePropsCommand(scene, clip.id, { scaleX: value, scaleY: value }, playhead, "Set scale", key)
    : undefined;
  const b = clip.base;
  return (
    <InspectorSection title="Transform" defaultOpen>
      <div className="grid grid-cols-2 gap-2">
        <AnimatableField clipId={clip.id} prop="x" label="X" unit="px" />
        <AnimatableField clipId={clip.id} prop="y" label="Y" unit="px" />
        <Field label="Width">
          <NumberField value={Math.round(b.width)} min={0} max={MAX_SCENE_SIZE} onCommit={(v) => setStatic("width", v)} className="pr-8" adornment={<Unit>px</Unit>} />
        </Field>
        <Field label="Height">
          <NumberField value={Math.round(b.height)} min={0} max={MAX_SCENE_SIZE} onCommit={(v) => setStatic("height", v)} className="pr-8" adornment={<Unit>px</Unit>} />
        </Field>
        <AnimatableField clipId={clip.id} prop="scaleX" label="Scale X" unit="%" scale={100} min={0} trailing={<UniformScaleLock />} buildCommand={scaleBoth} />
        <AnimatableField clipId={clip.id} prop="scaleY" label="Scale Y" unit="%" scale={100} min={0} buildCommand={scaleBoth} />
        <AnimatableField clipId={clip.id} prop="rotation" label="Rotation" unit="°" min={-3600} max={3600} digits={1} />
        <AnimatableField clipId={clip.id} prop="opacity" label="Opacity" unit="%" scale={100} min={0} max={100} />
      </div>
    </InspectorSection>
  );
}

/**
 * Where inside the box X and Y point at, and what rotation and scale turn
 * around. Moving it compensates X and Y so the box stays put on screen.
 */
function AnchorSection({ clip }: { clip: Clip }) {
  const api = useTimelineStoreApi();
  const ax = useTimeline((s) => {
    const loc = findClip(visibleScene(s), clip.id);
    return loc ? valueAt(loc.clip, "anchorX", s.playhead) : 0.5;
  });
  const ay = useTimeline((s) => {
    const loc = findClip(visibleScene(s), clip.id);
    return loc ? valueAt(loc.clip, "anchorY", s.playhead) : 0.5;
  });

  const reanchor = (scene: Parameters<typeof writePropsCommand>[0], anchorX: number, anchorY: number, playhead: number, key?: string): Command | null => {
    const loc = findClip(scene, clip.id);
    if (!loc) return null;
    const next = reanchorNode(nodeBoxAt(loc.clip, playhead), anchorX, anchorY);
    return writePropsCommand(scene, clip.id, next, playhead, "Move anchor", key);
  };
  const pick = (anchorX: number, anchorY: number) => {
    const s = api.getState();
    const cmd = reanchor(s.scene, anchorX, anchorY, s.playhead);
    if (cmd) s.execute(cmd);
  };
  const onCell = anchorIsOnCell(ax, ay);

  return (
    <InspectorSection title="Anchor" defaultOpen={false}>
      <div className="flex items-start gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Point</Label>
          <div className={cn(!onCell && "opacity-50")}>
            <AnchorPicker
              value={anchorToCell(ax, ay)}
              onChange={(cell) => {
                const a = cellToAnchor(cell);
                pick(a.anchorX, a.anchorY);
              }}
            />
          </div>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
          <AnimatableField
            clipId={clip.id}
            prop="anchorX"
            label="Anchor X"
            unit="%"
            scale={100}
            min={0}
            max={100}
            buildCommand={(scene, value, playhead, key) => {
              const loc = findClip(scene, clip.id);
              return loc ? reanchor(scene, value, valueAt(loc.clip, "anchorY", playhead), playhead, key) : null;
            }}
          />
          <AnimatableField
            clipId={clip.id}
            prop="anchorY"
            label="Anchor Y"
            unit="%"
            scale={100}
            min={0}
            max={100}
            buildCommand={(scene, value, playhead, key) => {
              const loc = findClip(scene, clip.id);
              return loc ? reanchor(scene, valueAt(loc.clip, "anchorX", playhead), value, playhead, key) : null;
            }}
          />
        </div>
      </div>
    </InspectorSection>
  );
}

function TimingSection({ clip }: { clip: Clip }) {
  const api = useTimelineStoreApi();
  const trim = (edge: "start" | "end", seconds: number) => {
    const s = api.getState();
    const loc = findClip(s.scene, clip.id);
    if (!loc) return;
    const t = clampClipTrim(loc.clip, edge, Math.round(seconds * 1000), neighboursOf(loc.layer.clips, clip.id));
    if (t === loc.clip[edge]) return;
    const cmd = trimClipCommand(s.scene, clip.id, edge, t);
    if (cmd) s.execute({ ...cmd, coalesceKey: `trim:${clip.id}:${edge}` });
  };
  return (
    <InspectorSection title="Timing" defaultOpen>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Start">
          <NumberField value={clip.start / 1000} min={0} onCommit={(v) => trim("start", v)} className="pr-8" adornment={<Unit>s</Unit>} />
        </Field>
        <Field label="End">
          <NumberField value={clip.end / 1000} min={0} onCommit={(v) => trim("end", v)} className="pr-8" adornment={<Unit>s</Unit>} />
        </Field>
      </div>
    </InspectorSection>
  );
}

function SourceSection({ clip }: { clip: Clip }) {
  const api = useTimelineStoreApi();
  const src = clip.source;
  const setSource = (next: ClipSource, key: string) => {
    const s = api.getState();
    const cmd = updateClipCommand(s.scene, clip.id, { source: next }, `src:${clip.id}:${key}`);
    if (cmd) s.execute(cmd);
  };

  if (src.kind === "text") {
    const patch = (p: Partial<Extract<ClipSource, { kind: "text" }>>, key: string) => setSource({ ...src, ...p }, key);
    return (
      <InspectorSection title="Text" defaultOpen>
        <div className="space-y-3">
          <Field label="Text">
            <Textarea value={src.text} rows={3} onChange={(e) => patch({ text: e.target.value.slice(0, 500) }, "text")} className="text-xs" />
            <div className="flex flex-wrap gap-1 pt-1">
              {ALERT_TEMPLATE_TOKENS.map((token) => (
                <Button key={token} type="button" size="xs" variant="outline" className="font-mono" onClick={() => patch({ text: `${src.text}{${token}}` }, "text")}>
                  {`{${token}}`}
                </Button>
              ))}
            </div>
          </Field>
          <GoogleFontSelect value={src.fontFamily} onValueChange={(v) => patch({ fontFamily: v }, "font")} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size">
              <NumberField value={src.fontSize} min={4} max={400} onCommit={(v) => patch({ fontSize: Math.round(v) }, "size")} className="pr-8" adornment={<Unit>px</Unit>} />
            </Field>
            <FontWeightSelect value={src.fontWeight} onValueChange={(v) => patch({ fontWeight: v }, "weight")} />
          </div>
          <TextAlignSelect value={src.align} onValueChange={(v) => patch({ align: v }, "align")} />
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[11px] text-muted-foreground">Colour</Label>
            <ColorPicker value={src.color} onChange={(v) => patch({ color: v }, "color")} aria-label="Text colour" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`shadow-${clip.id}`} className="text-[11px] text-muted-foreground">
              Shadow
            </Label>
            <Switch id={`shadow-${clip.id}`} checked={src.shadow} onCheckedChange={(v) => patch({ shadow: v }, "shadow")} />
          </div>
        </div>
      </InspectorSection>
    );
  }

  if (src.kind === "image") {
    return (
      <InspectorSection title="Image" defaultOpen>
        <div className="space-y-3">
          <MediaField label="Image" kinds={["image"]} value={src.url} onChange={(url) => setSource({ ...src, url }, "url")} />
          <Field label="Fit">
            <Select value={src.fit} onValueChange={(v) => setSource({ ...src, fit: v as typeof src.fit }, "fit")}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contain">Fit inside</SelectItem>
                <SelectItem value="cover">Fill and crop</SelectItem>
                <SelectItem value="fill">Stretch</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </InspectorSection>
    );
  }

  return null;
}

export function InspectorPanel() {
  const clipId = useTimeline((s) => s.selection.clipId);
  const clip = useTimeline((s) => (s.selection.clipId ? findClip(s.scene, s.selection.clipId)?.clip ?? null : null));
  const keyframeSelection = useTimeline((s) => s.selection.keyframe);

  return (
    <div className="h-full overflow-y-auto p-3">
      {clip ? (
        <div key={clipId} className="space-y-5">
          {keyframeSelection && <KeyframeSection key={keyframeSelection.keyframeId} selection={keyframeSelection} />}
          <SectionTitle>Selected clip</SectionTitle>
          <SourceSection clip={clip} />
          <TimingSection clip={clip} />
          <TransformSection clip={clip} />
          <AnchorSection clip={clip} />
        </div>
      ) : (
        <div className="space-y-5">
          <SceneSection />
          <p className="text-xs text-muted-foreground">Select a clip on the timeline to edit it.</p>
        </div>
      )}
    </div>
  );
}
