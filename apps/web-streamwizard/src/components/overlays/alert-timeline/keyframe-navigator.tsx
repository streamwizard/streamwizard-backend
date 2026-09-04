"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Diamond } from "lucide-react";
import { findClip, type PropName } from "@repo/alert-scene";
import { Tooltip, TooltipContent, TooltipTrigger, cn } from "@repo/ui";
import { deleteKeyframeCommand, writePropCommand } from "./commands";
import { keyframeAt, nextKeyframeTime, prevKeyframeTime } from "./keyframe-nav";
import { valueAt } from "./prop-writer";
import { useTimeline, useTimelineStoreApi, useTimelineView } from "./timeline-context";
import type { TimelineState } from "./timeline-store";

/** Buttons keep focus where it was so Space and arrows still hit the timeline. */
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

export function NavIconButton({
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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onMouseDown={keepFocus}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
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
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function trackTimes(state: TimelineState, clipId: string, prop: PropName): number[] {
  const loc = findClip(state.scene, clipId);
  return loc?.clip.tracks[prop]?.keyframes.map((k) => k.time) ?? [];
}

/**
 * Previous / add-or-remove / next for one animated property. Jumping also
 * selects the keyframe landed on, so the inspector shows its easing.
 */
export function KeyframeNavigator({ clipId, prop, disabled }: { clipId: string; prop: PropName; disabled?: boolean }) {
  const api = useTimelineStoreApi();
  const view = useTimelineView();
  const atKeyframe = useTimeline((s) => {
    const loc = findClip(s.scene, clipId);
    return !!loc && keyframeAt(loc.clip.tracks[prop], s.playhead) !== null;
  });
  const prev = useTimeline((s) => prevKeyframeTime(trackTimes(s, clipId, prop), s.playhead));
  const next = useTimeline((s) => nextKeyframeTime(trackTimes(s, clipId, prop), s.playhead));

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
    <div className="flex items-center" data-keyframe-nav={prop}>
      <NavIconButton label="Previous keyframe" disabled={disabled || prev === null} onClick={() => jump(prev)}>
        <ChevronLeft className="size-3.5" />
      </NavIconButton>
      <NavIconButton label={atKeyframe ? "Remove keyframe here" : "Add keyframe here"} active={atKeyframe} disabled={disabled} onClick={toggleKeyframe}>
        <Diamond className={cn("size-3", atKeyframe && "fill-current")} />
      </NavIconButton>
      <NavIconButton label="Next keyframe" disabled={disabled || next === null} onClick={() => jump(next)}>
        <ChevronRight className="size-3.5" />
      </NavIconButton>
    </div>
  );
}
