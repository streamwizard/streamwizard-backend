"use client";

import type { Clip, KeyframeTrack, Layer, PropName } from "@repo/alert-scene";
import { cn } from "@repo/ui";
import { useTimeline, useTimelineStoreApi } from "../timeline-context";
import { KeyframeMarker } from "./keyframe-marker";
import { msToPx } from "./timeline-math";
import { PROPERTY_ROW_HEIGHT_PX } from "./timeline-rows";

/** Track-pane row for one animated property: a band across the clip and its diamonds. */
export function PropertyTrackRow({ layer, clip, prop, track, width }: { layer: Layer; clip: Clip; prop: PropName; track: KeyframeTrack; width: number }) {
  const api = useTimelineStoreApi();
  const pxPerMs = useTimeline((s) => s.pxPerMs);
  const selected = useTimeline((s) => s.selection.keyframe?.clipId === clip.id && s.selection.keyframe.prop === prop);
  const left = msToPx(clip.start, pxPerMs);
  const bandWidth = Math.max(2, msToPx(clip.end - clip.start, pxPerMs));

  return (
    <div
      className={cn("relative border-b border-border/40", selected ? "bg-primary/5" : "bg-muted/10", !layer.visible && "opacity-50")}
      style={{ width, height: PROPERTY_ROW_HEIGHT_PX }}
      data-property-track={prop}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        api.getState().select({ layerId: layer.id, clipId: clip.id, keyframe: null });
      }}
    >
      <div className="pointer-events-none absolute inset-y-2 rounded-sm bg-foreground/[0.06]" style={{ left, width: bandWidth }} />
      {track.keyframes.map((kf) => (
        <KeyframeMarker key={kf.id} clip={clip} prop={prop} keyframe={kf} locked={layer.locked} />
      ))}
    </div>
  );
}
