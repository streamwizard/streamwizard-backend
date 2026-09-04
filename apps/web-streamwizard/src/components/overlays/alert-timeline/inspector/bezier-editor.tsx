"use client";

import { useRef } from "react";
import { setKeyframeEasing, type AlertScene, type CubicBezierEasing, type PropName } from "@repo/alert-scene";
import { cn } from "@repo/ui";
import { setKeyframeEasingCommand } from "../commands";
import { useTimelineStoreApi } from "../timeline-context";
import { usePointerDrag } from "../use-pointer-drag";
import { BEZIER_VIEW, curvePath, dragHandle, handlePoints } from "./bezier-math";

interface Gesture {
  which: 1 | 2;
  scene: AlertScene;
  from: CubicBezierEasing;
  /** Picture pixels per viewBox unit at pointer-down. */
  scale: number;
  curve: CubicBezierEasing;
}

/**
 * The curve between this keyframe and the next, with the two control
 * handles draggable. Dragging drafts the scene so the preview plays the
 * new motion straight away; releasing commits one undo step.
 */
export function BezierEditor({ clipId, prop, keyframeId, curve, disabled }: { clipId: string; prop: PropName; keyframeId: string; curve: CubicBezierEasing; disabled?: boolean }) {
  const api = useTimelineStoreApi();
  const svgRef = useRef<SVGSVGElement>(null);
  const { start, end, p1, p2 } = handlePoints(curve);

  const drag = usePointerDrag<Gesture, SVGCircleElement>({
    onStart: (e) => {
      if (disabled) return null;
      const which = Number(e.currentTarget.dataset.handle) as 1 | 2;
      if (which !== 1 && which !== 2) return null;
      const svg = svgRef.current;
      if (!svg) return null;
      const s = api.getState();
      if (s.playing) s.setPlaying(false);
      return { which, scene: s.scene, from: curve, scale: BEZIER_VIEW.width / svg.getBoundingClientRect().width, curve };
    },
    onMove: (m, g) => {
      const from = handlePoints(g.from);
      const origin = g.which === 1 ? from.p1 : from.p2;
      g.curve = dragHandle(g.from, g.which, { x: origin.x + m.dx * g.scale, y: origin.y + m.dy * g.scale });
      api.getState().setDraft(setKeyframeEasing(g.scene, clipId, prop, keyframeId, g.curve));
    },
    onEnd: (m, g) => {
      const s = api.getState();
      if (!m.moved) {
        s.commitDraft(null);
        return;
      }
      s.commitDraft(setKeyframeEasingCommand(g.scene, clipId, prop, keyframeId, g.curve));
    },
    onCancel: () => api.getState().commitDraft(null),
  });

  const { width, height } = BEZIER_VIEW;
  const unitTop = handlePoints(curve).end.y;
  const unitBottom = start.y;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("w-full touch-none select-none rounded-md border bg-muted/30", disabled && "opacity-60")}
      role="img"
      aria-label={`Easing curve: cubic-bezier(${curve.x1.toFixed(2)}, ${curve.y1.toFixed(2)}, ${curve.x2.toFixed(2)}, ${curve.y2.toFixed(2)})`}
      data-bezier-editor=""
    >
      {/* Unit square: the band a curve without overshoot stays inside. */}
      <rect x={start.x} y={unitTop} width={end.x - start.x} height={unitBottom - unitTop} className="fill-background/60 stroke-border" strokeWidth={1} />
      <line x1={start.x} y1={(unitTop + unitBottom) / 2} x2={end.x} y2={(unitTop + unitBottom) / 2} className="stroke-border" strokeDasharray="3 3" />
      <line x1={(start.x + end.x) / 2} y1={unitTop} x2={(start.x + end.x) / 2} y2={unitBottom} className="stroke-border" strokeDasharray="3 3" />
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="stroke-muted-foreground/30" strokeWidth={1} />
      {/* Handle arms */}
      <line x1={start.x} y1={start.y} x2={p1.x} y2={p1.y} className="stroke-primary/60" strokeWidth={1.5} />
      <line x1={end.x} y1={end.y} x2={p2.x} y2={p2.y} className="stroke-primary/60" strokeWidth={1.5} />
      <path d={curvePath(curve)} className="fill-none stroke-foreground" strokeWidth={2} strokeLinecap="round" />
      <circle cx={start.x} cy={start.y} r={3} className="fill-foreground" />
      <circle cx={end.x} cy={end.y} r={3} className="fill-foreground" />
      {/* Handles: big enough to grab, drawn small. */}
      {([1, 2] as const).map((which) => {
        const p = which === 1 ? p1 : p2;
        return (
          <g key={which}>
            <circle
              data-handle={which}
              cx={p.x}
              cy={p.y}
              r={11}
              className={cn("fill-transparent", disabled ? "cursor-not-allowed" : drag.dragging ? "cursor-grabbing" : "cursor-grab")}
              onPointerDown={drag.onPointerDown}
              role="slider"
              aria-label={which === 1 ? "First easing handle" : "Second easing handle"}
              aria-valuenow={which === 1 ? curve.y1 : curve.y2}
              tabIndex={-1}
            />
            <circle cx={p.x} cy={p.y} r={5} className="pointer-events-none fill-primary stroke-background" strokeWidth={1.5} />
          </g>
        );
      })}
    </svg>
  );
}
