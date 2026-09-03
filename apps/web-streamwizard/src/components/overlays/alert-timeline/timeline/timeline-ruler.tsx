"use client";

import { useTimeline, useTimelineStoreApi } from "../timeline-context";
import { formatRulerLabel } from "../format-time";
import { usePointerDrag } from "../use-pointer-drag";
import { RULER_HEIGHT_PX } from "./timeline-constants";
import { msToPx, niceTickMs, pxToMs, tickTimes } from "./timeline-math";

/** Time under a pointer, measured against the ruler's own (scrolled) box. */
function timeAt(clientX: number, el: HTMLElement, pxPerMs: number): number {
  const rect = el.getBoundingClientRect();
  return pxToMs(clientX - rect.left, pxPerMs);
}

export function TimelineRuler({ width }: { width: number }) {
  const api = useTimelineStoreApi();
  const pxPerMs = useTimeline((s) => s.pxPerMs);
  const duration = useTimeline((s) => s.scene.duration);
  const playheadValue = useTimeline((s) => Math.round(s.playhead));
  const step = niceTickMs(pxPerMs);
  const ticks = tickTimes(duration, step);
  const minor = step / 4;

  const scrub = usePointerDrag<{ el: HTMLElement }>({
    minDistance: 0,
    onStart: (e) => {
      const el = e.currentTarget;
      const s = api.getState();
      if (s.playing) s.setPlaying(false);
      s.setPlayhead(timeAt(e.clientX, el, s.pxPerMs));
      return { el };
    },
    onMove: (m, ctx) => api.getState().setPlayhead(timeAt(m.clientX, ctx.el, api.getState().pxPerMs)),
  });

  return (
    <div
      role="slider"
      aria-label="Timeline ruler. Drag to scrub."
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={playheadValue}
      aria-valuetext={`${(playheadValue / 1000).toFixed(2)} seconds`}
      onPointerDown={scrub.onPointerDown}
      className="relative cursor-ew-resize select-none border-b bg-background/95 backdrop-blur-sm"
      style={{ width, height: RULER_HEIGHT_PX }}
    >
      {ticks.map((t) => (
        <div key={t} className="absolute bottom-0 top-0" style={{ left: msToPx(t, pxPerMs) }}>
          <div className="absolute bottom-0 h-3 w-px bg-foreground/50" />
          <span className="absolute left-1 top-0.5 text-[10px] tabular-nums text-muted-foreground">{formatRulerLabel(t)}</span>
        </div>
      ))}
      {minor >= 1 &&
        ticks.flatMap((t) =>
          [1, 2, 3].map((i) => {
            const m = t + minor * i;
            if (m > duration) return null;
            return <div key={`${t}-${i}`} className="absolute bottom-0 h-1.5 w-px bg-foreground/25" style={{ left: msToPx(m, pxPerMs) }} />;
          })
        )}
      <div className="absolute bottom-0 top-0 w-px bg-destructive/60" style={{ left: msToPx(duration, pxPerMs) }} title="Scene end" />
    </div>
  );
}
