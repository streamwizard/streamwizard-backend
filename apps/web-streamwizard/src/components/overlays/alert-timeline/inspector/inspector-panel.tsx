"use client";

import { useRef } from "react";
import { findClip, type Clip, type ClipSource, type MediaFit, type PropName, type ShapeKind } from "@repo/alert-scene";
import { Link2, Unlink2 } from "lucide-react";
import { ColorPicker, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea, Tooltip, TooltipContent, TooltipTrigger, cn } from "@repo/ui";
import { NumberField } from "@/components/overlays/editor/number-field";
import { InspectorSection } from "@/components/overlays/editor/inspector-section";
import { FontWeightSelect, GoogleFontSelect, MediaField, SectionTitle, TextAlignSelect } from "@/components/overlays/inspector-fields";
import { AnchorPicker } from "@/components/overlays/editor/anchor-picker";
import { anchorIsOnCell, anchorToCell, cellToAnchor, nodeBoxAt, reanchorNode } from "../anchor-math";
import { setBasePropCommand, setSceneMetaCommand, trimClipCommand, updateClipCommand, writePropsCommand, type Command } from "../commands";
import { formatSeconds } from "../format-time";
import { useMediaInfo } from "../media-info";
import { clampTrimIn, footageEndMs, isMediaClip, mediaTrimLimits } from "../media-math";
import { valueAt } from "../prop-writer";
import { useTimeline, useTimelineStoreApi } from "../timeline-context";
import { visibleScene } from "../timeline-store";
import { clampClipTrim, neighboursOf } from "../timeline/timeline-math";
import { MAX_SCENE_DURATION_MS, MAX_SCENE_SIZE, MIN_CLIP_MS, MIN_SCENE_DURATION_MS } from "@repo/alert-scene";
import { AnimatableField } from "./animatable-field";
import { Field, Unit } from "./field-chrome";
import { KeyframeSection } from "./keyframe-section";
import { TokenChips } from "./token-chips";

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
  const media = isMediaClip(clip);
  const mediaUrl = clip.source.kind === "video" || clip.source.kind === "audio" ? clip.source.url : "";
  const info = useMediaInfo(mediaUrl, clip.source.kind === "audio" ? "audio" : "video");
  const sourceMs = info?.durationMs ?? null;

  const trim = (edge: "start" | "end", seconds: number) => {
    const s = api.getState();
    const loc = findClip(s.scene, clip.id);
    if (!loc) return;
    const t = clampClipTrim(loc.clip, edge, Math.round(seconds * 1000), neighboursOf(loc.layer.clips, clip.id), mediaTrimLimits(loc.clip, sourceMs));
    if (t === loc.clip[edge]) return;
    const cmd = trimClipCommand(s.scene, clip.id, edge, t);
    if (cmd) s.execute({ ...cmd, coalesceKey: `trim:${clip.id}:${edge}` });
  };

  // Where in the file the clip starts. The clip stays put; the footage slides.
  const setOffset = (seconds: number) => {
    const s = api.getState();
    const loc = findClip(s.scene, clip.id);
    if (!loc) return;
    const trimIn = clampTrimIn(loc.clip, seconds * 1000, sourceMs);
    if (trimIn === loc.clip.trimIn) return;
    const cmd = updateClipCommand(s.scene, clip.id, { trimIn }, `trimin:${clip.id}`, "Set source offset");
    if (cmd) s.execute(cmd);
  };

  const length = clip.end - clip.start;
  const runsOut = footageEndMs(clip, sourceMs) !== null;
  const sourceNote = !media
    ? null
    : info === undefined
      ? "Reading the file…"
      : sourceMs === null
        ? "The file did not say how long it is."
        : runsOut
          ? `The file is ${formatSeconds(sourceMs)} long and runs out before the clip ends.`
          : `The file is ${formatSeconds(sourceMs)} long.`;

  return (
    <InspectorSection title="Timing" defaultOpen>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start">
            <NumberField value={clip.start / 1000} min={0} onCommit={(v) => trim("start", v)} className="pr-8" adornment={<Unit>s</Unit>} />
          </Field>
          <Field label="End">
            <NumberField value={clip.end / 1000} min={0} onCommit={(v) => trim("end", v)} className="pr-8" adornment={<Unit>s</Unit>} />
          </Field>
          <Field label="Duration">
            <NumberField value={length / 1000} min={MIN_CLIP_MS / 1000} onCommit={(v) => trim("end", clip.start / 1000 + v)} className="pr-8" adornment={<Unit>s</Unit>} />
          </Field>
          {media && (
            <Field label="Source offset">
              <NumberField value={clip.trimIn / 1000} min={0} onCommit={setOffset} className="pr-8" adornment={<Unit>s</Unit>} />
            </Field>
          )}
        </div>
        {sourceNote && <p className="text-[11px] leading-snug text-muted-foreground">{sourceNote}</p>}
      </div>
    </InspectorSection>
  );
}

function FitSelect({ value, onValueChange }: { value: MediaFit; onValueChange: (v: MediaFit) => void }) {
  return (
    <Field label="Fit">
      <Select value={value} onValueChange={(v) => onValueChange(v as MediaFit)}>
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
  );
}

function SwitchRow({ id, label, checked, onCheckedChange, helper }: { id: string; label: string; checked: boolean; onCheckedChange: (v: boolean) => void; helper?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-[11px] text-muted-foreground">
          {label}
        </Label>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {helper && <p className="text-[11px] leading-snug text-muted-foreground/80">{helper}</p>}
    </div>
  );
}

function ColourRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <ColorPicker value={value} onChange={onChange} aria-label={`${label} colour`} />
    </div>
  );
}

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/** Volume for a video or sound clip; the layer's mute switch lives on the timeline. */
function SoundSection({ clip }: { clip: Clip }) {
  const muted = useTimeline((s) => findClip(s.scene, clip.id)?.layer.muted ?? false);
  return (
    <InspectorSection title="Sound" defaultOpen>
      <div className="space-y-2">
        <AnimatableField clipId={clip.id} prop="volume" label="Volume" unit="%" scale={100} min={0} max={100} />
        {muted && <p className="text-[11px] leading-snug text-muted-foreground">This layer is muted. Unmute it on the timeline to hear it.</p>}
      </div>
    </InspectorSection>
  );
}

/** Undo labels per source field, keyed the way `setSource` is called. */
const SOURCE_LABELS: Record<string, string> = {
  url: "Change file",
  fit: "Set fit",
  loop: "Toggle loop",
  shape: "Set shape",
  fill: "Set fill",
  radius: "Set corner radius",
  strokeWidth: "Set stroke",
  stroke: "Set stroke colour",
  text: "Edit text",
  font: "Change font",
  size: "Set text size",
  weight: "Set weight",
  align: "Set alignment",
  color: "Set text colour",
  shadow: "Toggle text shadow",
};

function SourceSection({ clip }: { clip: Clip }) {
  const api = useTimelineStoreApi();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const src = clip.source;
  const setSource = (next: ClipSource, key: string) => {
    const s = api.getState();
    const cmd = updateClipCommand(s.scene, clip.id, { source: next }, `src:${clip.id}:${key}`, SOURCE_LABELS[key] ?? "Edit clip");
    if (cmd) s.execute(cmd);
  };

  if (src.kind === "video") {
    return (
      <InspectorSection title="Video" defaultOpen>
        <div className="space-y-3">
          <MediaField label="Video" kinds={["video"]} value={src.url} helper="Transparent WebM keeps its alpha." onChange={(url) => setSource({ ...src, url }, "url")} />
          <FitSelect value={src.fit} onValueChange={(fit) => setSource({ ...src, fit }, "fit")} />
          <SwitchRow
            id={`loop-${clip.id}`}
            label="Loop"
            checked={src.loop}
            onCheckedChange={(loop) => setSource({ ...src, loop }, "loop")}
            helper={src.loop ? "Starts over when the video ends." : "Holds the last frame when the video ends."}
          />
        </div>
      </InspectorSection>
    );
  }

  if (src.kind === "audio") {
    return (
      <InspectorSection title="Audio" defaultOpen>
        <MediaField label="File" kinds={["audio"]} value={src.url} onChange={(url) => setSource({ ...src, url }, "url")} />
      </InspectorSection>
    );
  }

  if (src.kind === "shape") {
    const patch = (p: Partial<Extract<ClipSource, { kind: "shape" }>>, key: string) => setSource({ ...src, ...p }, key);
    return (
      <InspectorSection title="Shape" defaultOpen>
        <div className="space-y-3">
          <Field label="Shape">
            <Select value={src.shape} onValueChange={(v) => patch({ shape: v as ShapeKind }, "shape")}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rect">Rectangle</SelectItem>
                <SelectItem value="ellipse">Ellipse</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <ColourRow label="Fill" value={src.fill} onChange={(v) => patch({ fill: v }, "fill")} />
          {src.shape === "rect" && (
            <Field label="Corner radius">
              <NumberField value={src.radius} min={0} max={1000} onCommit={(v) => patch({ radius: Math.round(v) }, "radius")} className="pr-8" adornment={<Unit>px</Unit>} />
            </Field>
          )}
          <Field label="Stroke width">
            <NumberField
              value={src.strokeWidth}
              min={0}
              max={100}
              onCommit={(v) => {
                const strokeWidth = Math.round(v);
                // The picker is hex-only; a stroke that just appeared needs a real colour.
                patch(strokeWidth > 0 && !HEX_COLOUR.test(src.stroke) ? { strokeWidth, stroke: "#ffffff" } : { strokeWidth }, "strokeWidth");
              }}
              className="pr-8"
              adornment={<Unit>px</Unit>}
            />
          </Field>
          {src.strokeWidth > 0 && <ColourRow label="Stroke" value={src.stroke} onChange={(v) => patch({ stroke: v }, "stroke")} />}
        </div>
      </InspectorSection>
    );
  }

  if (src.kind === "text") {
    const patch = (p: Partial<Extract<ClipSource, { kind: "text" }>>, key: string) => setSource({ ...src, ...p }, key);
    return (
      <InspectorSection title="Text" defaultOpen>
        <div className="space-y-3">
          <Field label="Text">
            <Textarea ref={textareaRef} value={src.text} rows={3} onChange={(e) => patch({ text: e.target.value.slice(0, 500) }, "text")} className="text-xs" />
            <TokenChips text={src.text} textareaRef={textareaRef} onChange={(text) => patch({ text }, "text")} />
          </Field>
          <GoogleFontSelect value={src.fontFamily} onValueChange={(v) => patch({ fontFamily: v }, "font")} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size">
              <NumberField value={src.fontSize} min={4} max={400} onCommit={(v) => patch({ fontSize: Math.round(v) }, "size")} className="pr-8" adornment={<Unit>px</Unit>} />
            </Field>
            <FontWeightSelect value={src.fontWeight} onValueChange={(v) => patch({ fontWeight: v }, "weight")} />
          </div>
          <TextAlignSelect value={src.align} onValueChange={(v) => patch({ align: v }, "align")} />
          <ColourRow label="Text" value={src.color} onChange={(v) => patch({ color: v }, "color")} />
          <SwitchRow id={`shadow-${clip.id}`} label="Shadow" checked={src.shadow} onCheckedChange={(v) => patch({ shadow: v }, "shadow")} />
        </div>
      </InspectorSection>
    );
  }

  return (
    <InspectorSection title="Image" defaultOpen>
      <div className="space-y-3">
        <MediaField label="Image" kinds={["image"]} value={src.url} onChange={(url) => setSource({ ...src, url }, "url")} />
        <FitSelect value={src.fit} onValueChange={(fit) => setSource({ ...src, fit }, "fit")} />
      </div>
    </InspectorSection>
  );
}

export function InspectorPanel() {
  const clipId = useTimeline((s) => s.selection.clipId);
  // Draft included, so a stage drag shows its numbers while it happens.
  const clip = useTimeline((s) => (s.selection.clipId ? findClip(visibleScene(s), s.selection.clipId)?.clip ?? null : null));
  const keyframeSelection = useTimeline((s) => s.selection.keyframe);

  const hasSound = clip ? isMediaClip(clip) : false;
  // A sound clip has no box on the stage, so nothing to place or anchor.
  const hasPicture = clip ? clip.source.kind !== "audio" : false;

  return (
    <div className="h-full overflow-y-auto p-3">
      {clip ? (
        <div key={clipId} className="space-y-5">
          {keyframeSelection && <KeyframeSection key={keyframeSelection.keyframeId} selection={keyframeSelection} />}
          <SectionTitle>Selected clip</SectionTitle>
          <SourceSection clip={clip} />
          {hasSound && <SoundSection clip={clip} />}
          <TimingSection clip={clip} />
          {hasPicture && <TransformSection clip={clip} />}
          {hasPicture && <AnchorSection clip={clip} />}
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
