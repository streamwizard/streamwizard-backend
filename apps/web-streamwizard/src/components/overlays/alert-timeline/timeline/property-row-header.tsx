"use client";

import type { Clip, Layer, PropName } from "@repo/alert-scene";
import { cn } from "@repo/ui";
import { KeyframeNavigator } from "../keyframe-navigator";
import { useTimeline, useTimelineStoreApi } from "../timeline-context";
import { PROP_LABELS, PROPERTY_ROW_HEIGHT_PX } from "./timeline-rows";

/** Header-column row for one animated property: indented label plus navigator. */
export function PropertyRowHeader({ layer, clip, prop }: { layer: Layer; clip: Clip; prop: PropName }) {
  const api = useTimelineStoreApi();
  const selected = useTimeline((s) => s.selection.keyframe?.clipId === clip.id && s.selection.keyframe.prop === prop);
  return (
    <div
      className={cn("flex items-center gap-1 border-b border-border/40 pl-7 pr-1 text-[11px]", selected ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/40")}
      style={{ height: PROPERTY_ROW_HEIGHT_PX }}
      data-property-row={prop}
      onPointerDown={() => api.getState().select({ layerId: layer.id, clipId: clip.id, keyframe: null })}
    >
      <span className="flex-1 truncate">{PROP_LABELS[prop]}</span>
      <KeyframeNavigator clipId={clip.id} prop={prop} disabled={layer.locked} />
    </div>
  );
}
