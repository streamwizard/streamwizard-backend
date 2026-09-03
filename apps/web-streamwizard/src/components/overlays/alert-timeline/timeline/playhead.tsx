"use client";

import { useTimeline, useTimelineStoreApi } from "../timeline-context";
import { usePointerDrag } from "../use-pointer-drag";
import { RULER_HEIGHT_PX } from "./timeline-constants";
import { msToPx, pxToMs } from "./timeline-math";

/**
 * The red line. Lives in the scrolling content so it moves with the tracks;
 * only the handle in the ruler takes the pointer, the line itself lets clicks
 * through to the clips beneath it.
 */
export function Playhead() {
  const api = useTimelineStoreApi();
  const playhead = useTimeline((s) => s.playhead);
  const pxPerMs = useTimeline((s) => s.pxPerMs);
  const x = msToPx(playhead, pxPerMs);

  const drag = usePointerDrag<{ startTime: number; pxPerMs: number }>({
    onStart: () => {
      const s = api.getState();
      if (s.playing) s.setPlaying(false);
      return { startTime: s.playhead, pxPerMs: s.pxPerMs };
    },
    onMove: (m, ctx) => api.getState().setPlayhead(ctx.startTime + pxToMs(m.dx, ctx.pxPerMs)),
  });

  return (
    <div className="pointer-events-none absolute bottom-0 top-0 z-30" style={{ left: x }} data-playhead="">
      <div className="absolute bottom-0 top-0 w-px -translate-x-1/2 bg-red-500" />
      <button
        type="button"
        aria-label="Playhead"
        onPointerDown={drag.onPointerDown}
        className="pointer-events-auto absolute left-0 h-3.5 w-3.5 -translate-x-1/2 cursor-ew-resize bg-red-500 shadow"
        style={{ top: RULER_HEIGHT_PX - 14, clipPath: "polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%)" }}
      />
    </div>
  );
}
