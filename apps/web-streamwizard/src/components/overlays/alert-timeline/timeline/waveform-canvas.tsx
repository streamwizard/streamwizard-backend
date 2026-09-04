"use client";

import { useEffect, useRef } from "react";
import { usePlayback, useTimeline } from "../timeline-context";
import { bucketPeaks, type WaveformPeaks } from "../waveform/waveform-peaks";

/** Painted beyond the visible pane on each side, so small scrolls need no repaint. */
const OVERSCAN_PX = 200;

interface WaveformCanvasProps {
  /** undefined while decoding, null when there is nothing to draw. */
  peaks: WaveformPeaks | null | undefined;
  clipStart: number;
  clipEnd: number;
  trimIn: number;
}

/**
 * The waveform inside a media clip. Only the part of the clip that intersects
 * the visible pane (plus overscan) is painted: at full zoom a two minute clip
 * is a quarter of a million pixels wide, far past what a canvas allows.
 */
export function WaveformCanvas({ peaks, clipStart, clipEnd, trimIn }: WaveformCanvasProps) {
  const { paneRef } = usePlayback();
  const pxPerMs = useTimeline((s) => s.pxPerMs);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const pane = paneRef.current;
    if (!canvas || !pane) return;
    let frame = 0;
    let painted: { from: number; to: number } | null = null;
    const clipLeft = clipStart * pxPerMs;
    const clipWidth = Math.max(2, (clipEnd - clipStart) * pxPerMs);

    // The window of the clip, in clip-local px, that the pane shows right now.
    const wanted = (overscan: number) => ({
      from: Math.max(0, Math.floor(pane.scrollLeft - overscan - clipLeft)),
      to: Math.min(clipWidth, Math.ceil(pane.scrollLeft + pane.clientWidth + overscan - clipLeft)),
    });

    const paint = () => {
      frame = 0;
      const { from, to } = wanted(OVERSCAN_PX);
      const width = Math.max(0, to - from);
      const height = canvas.offsetHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.style.left = `${from}px`;
      canvas.style.width = `${width}px`;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      painted = { from, to };
      if (width === 0 || height === 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = getComputedStyle(canvas).color;
      const mid = height / 2;
      if (!peaks) {
        // Nothing to draw: a quiet centre line, not an error.
        if (peaks === null) {
          ctx.globalAlpha = 0.3;
          ctx.fillRect(0, mid - 0.5, width, 1);
        }
        return;
      }
      const data = bucketPeaks(peaks, trimIn + from / pxPerMs, trimIn + to / pxPerMs, width);
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const top = mid - data[x * 2 + 1]! * mid;
        const bottom = mid - data[x * 2]! * mid;
        ctx.rect(x, top, 1, Math.max(1, bottom - top));
      }
      ctx.fill();
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onScroll = () => {
      if (painted) {
        const { from, to } = wanted(0);
        if (from >= painted.from && to <= painted.to) return;
      }
      schedule();
    };

    schedule();
    pane.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(pane);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      pane.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [peaks, clipStart, clipEnd, trimIn, pxPerMs, paneRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-waveform={peaks ? "ready" : peaks === null ? "none" : "loading"}
      className="pointer-events-none absolute inset-y-0 left-0 block"
    />
  );
}
