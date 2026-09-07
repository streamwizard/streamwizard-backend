"use client";

import { Slider } from "@repo/ui";
import type { MetricKey } from "./switcher-demo-store";

/*
 * One signal slider inside a metric row. In walk mode the thumb follows the
 * scripted walk, snapping once a second like the numbers do; grabbing it hands
 * the sample source to the visitor. The purple tick marks where the active
 * preset's threshold sits on the track.
 */

const SLIDER_CONFIG: Record<MetricKey, { min: number; max: number; step: number; ariaLabel: string }> = {
  // Ranges cover every preset threshold and the walk's own extremes, so the
  // walk-following thumb never clamps. Bitrate reaches 0: the feed goes silent.
  bitrate: { min: 0, max: 8000, step: 50, ariaLabel: "Bitrate in kilobits per second" },
  rtt: { min: 20, max: 3000, step: 10, ariaLabel: "Ping in milliseconds" },
  loss: { min: 0, max: 6, step: 0.1, ariaLabel: "Dropped packets in percent" },
};

interface SignalSliderProps {
  metricKey: MetricKey;
  value: number;
  threshold: number;
  mode: "walk" | "manual";
  onGrab: () => void;
  onChange: (value: number) => void;
}

export function SignalSlider({ metricKey, value, threshold, mode, onGrab, onChange }: SignalSliderProps) {
  const cfg = SLIDER_CONFIG[metricKey];
  const clamped = Math.min(cfg.max, Math.max(cfg.min, value));
  const tick = ((threshold - cfg.min) / (cfg.max - cfg.min)) * 100;

  return (
    <div className="relative">
      <Slider
        value={[clamped]}
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        aria-label={cfg.ariaLabel}
        onPointerDown={onGrab}
        onValueChange={([next]) => onChange(next ?? cfg.min)}
        className={`[&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:bg-white/[0.07] [&_[data-slot=slider-range]]:bg-purple-400/50 [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-purple-300/60 ${
          mode === "walk" ? "cursor-grab [&_[data-slot=slider-thumb]]:opacity-70" : ""
        }`}
      />
      {/* Threshold marker; the number itself is printed next to the streak bar. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-300/80"
        style={{ left: `${tick}%` }}
      />
    </div>
  );
}
