"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Diamond, Timer } from "lucide-react";
import { findClip, type AlertScene, type PropName } from "@repo/alert-scene";
import { Label, Tooltip, TooltipContent, TooltipTrigger, cn } from "@repo/ui";
import { NumberField } from "@/components/overlays/editor/number-field";
import { deleteKeyframeCommand, stopwatchOffCommand, stopwatchOnCommand, writePropCommand, type Command } from "../commands";
import { keyframeAt, nextKeyframeTime, prevKeyframeTime } from "../keyframe-nav";
import { hasTrack, keyframeTime, valueAt } from "../prop-writer";
import { useTimeline, useTimelineStoreApi, useTimelineView } from "../timeline-context";
import { visibleScene, type TimelineState } from "../timeline-store";
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

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Buttons keep focus where it was so Space and arrows still hit the timeline. */
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

function IconButton({
  label,
  active,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onMouseDown={keepFocus}
        onClick={onClick}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors",
          "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-40",
          active && "text-primary hover:text-primary",
          className
        )}
      >
        {children}
      </button>
    </Tip>
  );
}

function trackTimes(state: TimelineState, clipId: string, prop: PropName): number[] {
  const loc = findClip(state.scene, clipId);
  return loc?.clip.tracks[prop]?.keyframes.map((k) => k.time) ?? [];
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
  const view = useTimelineView();

  const animated = useTimeline((s) => {
    const loc = findClip(s.scene, clipId);
    return !!loc && hasTrack(loc.clip, prop);
  });
  const value = useTimeline((s) => {
    const loc = findClip(visibleScene(s), clipId);
    return loc ? valueAt(loc.clip, prop, s.playhead) : 0;
  });
  const atKeyframe = useTimeline((s) => {
    const loc = findClip(s.scene, clipId);
    return !!loc && keyframeAt(loc.clip.tracks[prop], s.playhead) !== null;
  });
  const prev = useTimeline((s) => prevKeyframeTime(trackTimes(s, clipId, prop), s.playhead));
  const next = useTimeline((s) => nextKeyframeTime(trackTimes(s, clipId, prop), s.playhead));

  const commit = (fieldValue: number) => {
    const s = api.getState();
    const model = fieldValue / scale;
    const key = `prop:${clipId}:${prop}:${keyframeTime(s.playhead)}`;
    const cmd = buildCommand ? buildCommand(s.scene, model, s.playhead, key) : writePropCommand(s.scene, clipId, prop, model, s.playhead, key);
    if (cmd) s.execute(cmd);
  };

  const toggleStopwatch = () => {
    const s = api.getState();
    const cmd = animated ? stopwatchOffCommand(s.scene, clipId, prop, s.playhead) : stopwatchOnCommand(s.scene, clipId, prop, s.playhead);
    if (cmd) s.execute(cmd);
  };

  const jump = (t: number | null) => {
    if (t === null) return;
    const s = api.getState();
    s.setPlaying(false);
    s.setPlayhead(t);
    view.scrollToTime(t);
    const kf = keyframeAt(findClip(s.scene, clipId)?.clip.tracks[prop], t);
    if (kf) s.selectKeyframe(clipId, prop, kf.id);
  };

  const toggleKeyframe = () => {
    const s = api.getState();
    const loc = findClip(s.scene, clipId);
    if (!loc) return;
    const kf = keyframeAt(loc.clip.tracks[prop], s.playhead);
    const cmd = kf
      ? deleteKeyframeCommand(s.scene, clipId, prop, kf.id, s.playhead)
      : writePropCommand(s.scene, clipId, prop, valueAt(loc.clip, prop, s.playhead), s.playhead);
    if (cmd) s.execute(cmd);
  };

  return (
    <div className="space-y-1" data-animatable-field={prop}>
      <div className="flex h-5 items-center gap-1">
        <IconButton label={animated ? `Stop animating ${label}` : `Animate ${label}`} active={animated} disabled={disabled} onClick={toggleStopwatch} className="-ml-1">
          <Timer className="size-3.5" />
        </IconButton>
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        {trailing}
        {animated && (
          <div className="ml-auto flex items-center" data-keyframe-nav={prop}>
            <IconButton label="Previous keyframe" disabled={disabled || prev === null} onClick={() => jump(prev)}>
              <ChevronLeft className="size-3.5" />
            </IconButton>
            <IconButton label={atKeyframe ? "Remove keyframe here" : "Add keyframe here"} active={atKeyframe} disabled={disabled} onClick={toggleKeyframe}>
              <Diamond className={cn("size-3", atKeyframe && "fill-current")} />
            </IconButton>
            <IconButton label="Next keyframe" disabled={disabled || next === null} onClick={() => jump(next)}>
              <ChevronRight className="size-3.5" />
            </IconButton>
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
