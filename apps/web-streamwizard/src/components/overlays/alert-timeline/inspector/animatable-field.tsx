"use client";

import type { ReactNode } from "react";
import { Timer } from "lucide-react";
import { findClip, type AlertScene, type PropName } from "@repo/alert-scene";
import { Label, cn } from "@repo/ui";
import { NumberField } from "@/components/overlays/editor/number-field";
import { stopwatchOffCommand, stopwatchOnCommand, writePropCommand, type Command } from "../commands";
import { KeyframeNavigator, NavIconButton } from "../keyframe-navigator";
import { hasTrack, keyframeTime, valueAt } from "../prop-writer";
import { useTimeline, useTimelineStoreApi } from "../timeline-context";
import { visibleScene } from "../timeline-store";
import { Unit } from "./field-chrome";

export interface AnimatableFieldProps {
  clipId: string;
  prop: PropName;
  label: string;
  /** The field shows model × scale: opacity 0..1 reads as 0..100. */
  scale?: number;
  /** Decimals shown; the model keeps full precision. */
  digits?: number;
  unit?: string;
  /** Bounds in field units. */
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Extra control shown after the label (the uniform-scale lock). */
  trailing?: ReactNode;
  /** How a new model value becomes a command; defaults to the auto-keyframe rule. */
  buildCommand?: (scene: AlertScene, value: number, playheadMs: number, coalesceKey: string) => Command | null;
}

function roundTo(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * One animatable property: stopwatch, label, the value at the playhead and,
 * once animated, a keyframe navigator. Edits go through the auto-keyframe
 * rule, so typing with the stopwatch on adds or updates a keyframe where
 * the playhead sits and typing with it off changes the static value.
 */
export function AnimatableField({
  clipId,
  prop,
  label,
  scale = 1,
  digits = 0,
  unit,
  min,
  max,
  disabled,
  trailing,
  buildCommand,
}: AnimatableFieldProps) {
  const api = useTimelineStoreApi();

  const animated = useTimeline((s) => {
    const loc = findClip(s.scene, clipId);
    return !!loc && hasTrack(loc.clip, prop);
  });
  const value = useTimeline((s) => {
    const loc = findClip(visibleScene(s), clipId);
    return loc ? valueAt(loc.clip, prop, s.playhead) : 0;
  });

  const commit = (fieldValue: number) => {
    const s = api.getState();
    const model = fieldValue / scale;
    const key = `prop:${clipId}:${prop}:${keyframeTime(s.playhead)}`;
    const cmd = buildCommand ? buildCommand(s.scene, model, s.playhead, key) : writePropCommand(s.scene, clipId, prop, model, s.playhead, key);
    if (cmd) s.execute(cmd);
  };

  const toggleStopwatch = () => {
    const s = api.getState();
    if (animated) {
      const cmd = stopwatchOffCommand(s.scene, clipId, prop, s.playhead);
      if (cmd) s.execute(cmd);
      return;
    }
    const cmd = stopwatchOnCommand(s.scene, clipId, prop, s.playhead);
    if (!cmd) return;
    s.execute(cmd);
    // The new row should be visible on the timeline, not hidden behind a chevron.
    const layerId = findClip(s.scene, clipId)?.layer.id;
    if (layerId) s.setLayerExpanded(layerId, true);
  };

  return (
    <div className="space-y-1" data-animatable-field={prop}>
      <div className="flex h-5 items-center gap-1">
        <NavIconButton label={animated ? `Stop animating ${label}` : `Animate ${label}`} active={animated} disabled={disabled} onClick={toggleStopwatch} className="-ml-1">
          <Timer className="size-3.5" />
        </NavIconButton>
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        {trailing}
        {animated && (
          <div className="ml-auto">
            <KeyframeNavigator clipId={clipId} prop={prop} disabled={disabled} />
          </div>
        )}
      </div>
      <NumberField
        value={roundTo(value * scale, digits)}
        min={min}
        max={max}
        disabled={disabled}
        onCommit={commit}
        className={cn(unit && "pr-8")}
        adornment={unit ? <Unit>{unit}</Unit> : undefined}
      />
    </div>
  );
}
