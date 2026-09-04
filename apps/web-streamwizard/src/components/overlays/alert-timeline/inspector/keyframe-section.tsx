"use client";

import { findClip, isBezier, type Keyframe, type PropName } from "@repo/alert-scene";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { InspectorSection } from "@/components/overlays/editor/inspector-section";
import { NumberField } from "@/components/overlays/editor/number-field";
import { moveKeyframeCommand, setKeyframeCommand, setKeyframeEasingCommand, setTrackCommand } from "../commands";
import { keyframeTime } from "../prop-writer";
import { useTimeline, useTimelineStoreApi } from "../timeline-context";
import { visibleScene, type KeyframeSelection } from "../timeline-store";
import { PROP_LABELS } from "../timeline/timeline-rows";
import { BezierEditor } from "./bezier-editor";
import { PRESET_OPTIONS, asBezier, easingForPreset, presetForEasing, type PresetChoice } from "./bezier-math";
import { Field, Unit } from "./field-chrome";

/** Field scale per property so the value reads like the inspector does. */
const VALUE_SCALE: Partial<Record<PropName, { scale: number; unit: string }>> = {
  opacity: { scale: 100, unit: "%" },
  scaleX: { scale: 100, unit: "%" },
  scaleY: { scale: 100, unit: "%" },
  anchorX: { scale: 100, unit: "%" },
  anchorY: { scale: 100, unit: "%" },
  rotation: { scale: 1, unit: "°" },
  volume: { scale: 100, unit: "%" },
};

/**
 * The selected keyframe: when it sits, what it holds and how the value moves
 * on to the next keyframe. Easing lives on the keyframe it leaves from.
 */
export function KeyframeSection({ selection }: { selection: KeyframeSelection }) {
  const api = useTimelineStoreApi();
  const { clipId, prop, keyframeId } = selection;
  const clip = useTimeline((s) => findClip(visibleScene(s), clipId)?.clip ?? null);
  const locked = useTimeline((s) => findClip(s.scene, clipId)?.layer.locked ?? false);
  const track = clip?.tracks[prop];
  const keyframe = track?.keyframes.find((k) => k.id === keyframeId) ?? null;
  if (!clip || !track || !keyframe) return null;

  const isLast = track.keyframes[track.keyframes.length - 1]?.id === keyframeId;
  const choice = presetForEasing(keyframe.easing);
  const bezier = asBezier(keyframe.easing);
  const format = VALUE_SCALE[prop] ?? { scale: 1, unit: "px" };

  const setTime = (seconds: number) => {
    const s = api.getState();
    const t = keyframeTime(Math.min(clip.end, Math.max(clip.start, seconds * 1000)));
    if (t === keyframe.time) return;
    const cmd = moveKeyframeCommand(s.scene, clipId, prop, keyframeId, t);
    if (cmd) s.execute(cmd);
  };
  const setValue = (fieldValue: number) => {
    const s = api.getState();
    const cmd = setKeyframeCommand(s.scene, clipId, prop, { time: keyframe.time, value: fieldValue / format.scale, easing: keyframe.easing }, `kf:${keyframeId}:value`);
    if (cmd) s.execute(cmd);
  };
  const setPreset = (next: PresetChoice) => {
    const s = api.getState();
    const cmd = setKeyframeEasingCommand(s.scene, clipId, prop, keyframeId, easingForPreset(next, keyframe.easing));
    if (cmd) s.execute(cmd);
  };
  const setCurve = (patch: Partial<{ x1: number; y1: number; x2: number; y2: number }>, key: string) => {
    if (!bezier) return;
    const s = api.getState();
    const cmd = setKeyframeEasingCommand(s.scene, clipId, prop, keyframeId, { ...bezier, ...patch });
    if (cmd) s.execute({ ...cmd, coalesceKey: `kf:${keyframeId}:${key}` });
  };
  const applyToTrack = () => {
    const s = api.getState();
    const loc = findClip(s.scene, clipId);
    const live = loc?.clip.tracks[prop];
    if (!live) return;
    const easing = keyframe.easing;
    const next: Keyframe[] = live.keyframes.map((k) => ({ ...k, easing: isBezier(easing) ? { ...easing } : easing }));
    const cmd = setTrackCommand(s.scene, clipId, prop, next);
    if (cmd) s.execute({ ...cmd, label: "Apply easing to all keyframes" });
  };

  return (
    <InspectorSection title={`Keyframe · ${PROP_LABELS[prop]}`} defaultOpen>
      <div className="space-y-3" data-keyframe-section={keyframeId}>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Time">
            <NumberField value={Math.round(keyframe.time) / 1000} min={clip.start / 1000} max={clip.end / 1000} disabled={locked} onCommit={setTime} className="pr-8" adornment={<Unit>s</Unit>} />
          </Field>
          <Field label="Value">
            <NumberField value={Math.round(keyframe.value * format.scale * 100) / 100} disabled={locked} onCommit={setValue} className="pr-8" adornment={<Unit>{format.unit}</Unit>} />
          </Field>
        </div>
        <Field label="Easing to the next keyframe">
          <Select value={choice} onValueChange={(v) => setPreset(v as PresetChoice)} disabled={locked}>
            <SelectTrigger className="h-8 text-xs" aria-label="Easing">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {bezier ? (
          <div className="space-y-2">
            <BezierEditor clipId={clipId} prop={prop} keyframeId={keyframeId} curve={bezier} disabled={locked} />
            <div className="grid grid-cols-4 gap-1">
              {(["x1", "y1", "x2", "y2"] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <Label className="text-[10px] font-mono text-muted-foreground">{k}</Label>
                  <NumberField
                    value={Math.round(bezier[k] * 100) / 100}
                    min={k.startsWith("x") ? 0 : -2}
                    max={k.startsWith("x") ? 1 : 3}
                    disabled={locked}
                    onCommit={(v) => setCurve({ [k]: v }, k)}
                    className="px-1.5 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">Hold keeps this value until the next keyframe, then jumps.</p>
        )}
        {isLast && track.keyframes.length > 1 && <p className="text-[11px] text-muted-foreground">Last keyframe on this property. Easing only shows on the way to a next one.</p>}
        <Button type="button" size="xs" variant="outline" className="w-full" disabled={locked || track.keyframes.length < 2} onClick={applyToTrack}>
          Apply easing to all {PROP_LABELS[prop]} keyframes
        </Button>
      </div>
    </InspectorSection>
  );
}

