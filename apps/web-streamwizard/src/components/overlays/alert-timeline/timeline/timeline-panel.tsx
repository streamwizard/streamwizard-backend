"use client";

import { useRef } from "react";
import { usePlayback, useTimeline, useTimelineStoreApi, useTimelineView } from "../timeline-context";
import { useTimelineWheel } from "../use-timeline-view";
import { visibleScene } from "../timeline-store";
import { LayerHeader } from "./layer-header";
import { Playhead } from "./playhead";
import { PropertyRowHeader } from "./property-row-header";
import { PropertyTrackRow } from "./property-track-row";
import { HEADER_COLUMN_PX, RULER_HEIGHT_PX } from "./timeline-constants";
import { msToPx, TIMELINE_END_PADDING_PX } from "./timeline-math";
import { buildTimelineRows } from "./timeline-rows";
import { TimelineRuler } from "./timeline-ruler";
import { TrackRow } from "./track-row";

/**
 * Two columns: a fixed header column and the scrolling track pane. The pane
 * scrolls both axes natively; the header column mirrors its vertical scroll
 * so the two never drift, and the ruler sticks to the top of the pane.
 */
export function TimelinePanel() {
  const api = useTimelineStoreApi();
  const { paneRef } = usePlayback();
  useTimelineWheel(paneRef, useTimelineView());
  const headerColRef = useRef<HTMLDivElement>(null);
  const scene = useTimeline(visibleScene);
  const pxPerMs = useTimeline((s) => s.pxPerMs);
  const expanded = useTimeline((s) => s.expandedLayerIds);
  const contentWidth = msToPx(scene.duration, pxPerMs) + TIMELINE_END_PADDING_PX;
  const rows = buildTimelineRows(scene, expanded);

  return (
    <div className="flex h-full min-h-0 w-full select-none" data-timeline="">
      <div ref={headerColRef} className="shrink-0 overflow-hidden border-r bg-background" style={{ width: HEADER_COLUMN_PX }}>
        <div className="flex items-center border-b px-2 text-[11px] uppercase tracking-wider text-muted-foreground" style={{ height: RULER_HEIGHT_PX }}>
          Layers
        </div>
        {rows.map((row) =>
          row.kind === "layer" ? (
            <LayerHeader key={row.key} layer={row.layer} />
          ) : (
            <PropertyRowHeader key={row.key} layer={row.layer} clip={row.clip} prop={row.prop} />
          )
        )}
      </div>
      <div
        ref={paneRef}
        tabIndex={-1}
        aria-label="Timeline tracks"
        className="relative min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
        onScroll={(e) => {
          if (headerColRef.current) headerColRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
        onPointerDownCapture={() => paneRef.current?.focus({ preventScroll: true })}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) api.getState().clearSelection();
        }}
      >
        <div className="relative" style={{ width: contentWidth, minHeight: "100%" }}>
          <div className="sticky top-0 z-20">
            <TimelineRuler width={contentWidth} />
          </div>
          {rows.map((row) =>
            row.kind === "layer" ? (
              <TrackRow key={row.key} layer={row.layer} width={contentWidth} />
            ) : (
              <PropertyTrackRow key={row.key} layer={row.layer} clip={row.clip} prop={row.prop} track={row.track} width={contentWidth} />
            )
          )}
          {scene.layers.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-sm text-muted-foreground">
              No layers yet. Add text or an image and it lands at the playhead.
            </div>
          )}
          <Playhead />
        </div>
      </div>
    </div>
  );
}
