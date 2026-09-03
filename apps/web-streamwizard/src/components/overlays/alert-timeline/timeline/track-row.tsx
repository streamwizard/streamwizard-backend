"use client";

import type { Layer } from "@repo/alert-scene";
import { cn } from "@repo/ui";
import { useTimeline, useTimelineStoreApi } from "../timeline-context";
import { ClipBlock } from "./clip-block";
import { ROW_HEIGHT_PX } from "./timeline-constants";
import { msToPx } from "./timeline-math";

export function TrackRow({ layer, width }: { layer: Layer; width: number }) {
  const api = useTimelineStoreApi();
  const pxPerMs = useTimeline((s) => s.pxPerMs);
  const duration = useTimeline((s) => s.scene.duration);
  const selectedLayer = useTimeline((s) => s.selection.layerId === layer.id);

  return (
    <div
      className={cn("relative border-b border-border/60", selectedLayer ? "bg-primary/5" : "odd:bg-muted/20", !layer.visible && "opacity-50")}
      style={{ width, height: ROW_HEIGHT_PX }}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        api.getState().select({ layerId: layer.id, clipId: null, keyframe: null });
      }}
    >
      {/* Past the scene end nothing plays; shade it so a clip parked there reads as off. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 bg-foreground/[0.04]" style={{ left: msToPx(duration, pxPerMs) }} />
      {layer.clips.map((clip) => (
        <ClipBlock key={clip.id} clip={clip} layer={layer} />
      ))}
    </div>
  );
}
