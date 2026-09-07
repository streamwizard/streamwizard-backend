"use client";

import { useEffect, useState } from "react";
import { rulerStep, rulerTicks } from "./canvas-preferences";

/** Wide enough for a four-digit label plus its padding; 1000 overflowed 26px. */
export const RULER_THICKNESS_PX = 34;

/** Breathing room so an end label is not flush against the clipping boundary. */
const EDGE_INSET_PX = 2;

/** Keeps the cursor readout clear of its own marker line. */
const MARKER_LABEL_GAP_PX = 3;

interface CanvasRulersProps {
  /** Scene dimensions in scene px. */
  width: number;
  height: number;
  zoom: number;
  /** The scaled canvas box, measured live to place the cursor marker. */
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** Track the pointer along the gutters. */
  showCursor: boolean;
}

/**
 * Where the pointer is, in scene px.
 *
 * Tracked in here rather than in the canvas so a hover only re-renders two thin
 * gutters. Holding it a level up would re-render every widget on the scene on
 * every pixel of mouse movement.
 */
function usePointerScenePosition(
  canvasRef: React.RefObject<HTMLDivElement | null>,
  zoom: number,
  width: number,
  height: number,
  enabled: boolean
) {
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Switched off means no listener at all, not a hidden marker.
    if (!enabled) return;

    function handleMove(event: MouseEvent) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (event.clientX - rect.left) / zoom;
      const y = (event.clientY - rect.top) / zoom;
      // Off the scene means nothing to point at; drop the marker entirely
      // rather than pin it to an edge it isn't near.
      setPointer(x < 0 || y < 0 || x > width || y > height ? null : { x, y });
    }

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [canvasRef, zoom, width, height, enabled]);

  // Derived rather than cleared on the way out: dropping the listener leaves the
  // last position in state, which would strand the marker wherever the pointer
  // happened to be when the toggle went off.
  return enabled ? pointer : null;
}

/**
 * Scene-pixel rulers along the top and left edges.
 *
 * Rendered inside the canvas box rather than pinned to the pane, so they inherit
 * the canvas's own position — which is what keeps them honest under both zoom
 * and the pan offset without tracking either.
 *
 * Labels are centred on their tick and pulled inside at both ends, so the first
 * and last never hang off the edge and get clipped.
 *
 * The gutters draw no background of their own. Any fill here is a near-black
 * next to the canvas's own near-black, and the two never quite match — the
 * seam reads as a lighter band down the side. Ticks and numbers over the
 * editor's backdrop have no such problem.
 */
export function CanvasRulers({
  width,
  height,
  zoom,
  canvasRef,
  showCursor,
}: CanvasRulersProps) {
  const pointer = usePointerScenePosition(canvasRef, zoom, width, height, showCursor);
  const step = rulerStep(zoom);
  const horizontal = rulerTicks(width, step);
  const vertical = rulerTicks(height, step);

  /**
   * Keeps the end labels within the gutter instead of half outside it.
   *
   * The end label is pulled a further couple of px inward: right-aligning it
   * lands its edge exactly on the gutter's own boundary, where sub-pixel
   * rounding shaves the last digit off under `overflow-hidden`.
   */
  function align(tick: number, ticks: number[]) {
    if (tick === ticks[0]) return `translateX(${EDGE_INSET_PX}px)`;
    if (tick === ticks[ticks.length - 1]) {
      return `translateX(-100%) translateX(-${EDGE_INSET_PX}px)`;
    }
    return "translateX(-50%)";
  }

  return (
    <>
      <div
        className="absolute left-0 right-0 overflow-hidden text-[10px] leading-none text-muted-foreground select-none pointer-events-none"
        style={{ top: -RULER_THICKNESS_PX, height: RULER_THICKNESS_PX }}
      >
        {horizontal.map((tick) => (
          <div key={tick} className="absolute bottom-0" style={{ left: tick * zoom }}>
            <span className="absolute bottom-1.5 block whitespace-nowrap tabular-nums"
              style={{ transform: align(tick, horizontal) }}
            >
              {tick}
            </span>
            <span className="absolute bottom-0 block w-px bg-border" style={{ height: 5 }} />
          </div>
        ))}

        {pointer && (
          <div
            className="absolute inset-y-0 w-px bg-primary"
            style={{ left: pointer.x * zoom }}
          >
            {/* Top of the gutter, clear of the tick numbers at the bottom, and
                beside its own line rather than centred on it -- centred, the
                line runs straight through the digits. */}
            <span
              className="absolute top-0 block whitespace-nowrap tabular-nums text-primary"
              style={{ transform: `translateX(${MARKER_LABEL_GAP_PX}px)` }}
            >
              {Math.round(pointer.x)}
            </span>
          </div>
        )}
      </div>

      <div
        className="absolute top-0 bottom-0 overflow-hidden text-[10px] leading-none text-muted-foreground select-none pointer-events-none"
        style={{ left: -RULER_THICKNESS_PX, width: RULER_THICKNESS_PX }}
      >
        {vertical.map((tick) => (
          <div key={tick} className="absolute right-0" style={{ top: tick * zoom }}>
            {/* Horizontal, right-aligned under the tick: a rotated number in a
                gutter this narrow is unreadable at this size. */}
            <span
              className="absolute right-1.5 block whitespace-nowrap tabular-nums"
              style={{
                transform:
                  tick === vertical[0]
                    ? `translateY(${EDGE_INSET_PX}px)`
                    : tick === vertical[vertical.length - 1]
                      ? `translateY(-100%) translateY(-${EDGE_INSET_PX}px)`
                      : "translateY(-50%)",
              }}
            >
              {tick}
            </span>
            <span className="absolute right-0 top-0 block h-px bg-border" style={{ width: 5 }} />
          </div>
        ))}

        {pointer && (
          <div
            className="absolute inset-x-0 h-px bg-primary"
            style={{ top: pointer.y * zoom }}
          >
            {/* Left-aligned, against the tick numbers on the right, and sitting
                above its line instead of on it. */}
            <span
              className="absolute left-0.5 block whitespace-nowrap tabular-nums text-primary"
              style={{
                transform: `translateY(-100%) translateY(-${MARKER_LABEL_GAP_PX}px)`,
              }}
            >
              {Math.round(pointer.y)}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
