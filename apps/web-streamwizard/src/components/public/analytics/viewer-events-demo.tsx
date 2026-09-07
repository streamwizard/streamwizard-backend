"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView } from "motion/react";
import { cn } from "@repo/ui";
import { useDemoTracking } from "./use-demo-tracking";
import {
  DEMO_VOD_DURATION_SECONDS,
  demoActivityEvents,
  demoClips,
  demoFollowEvents,
  demoSubEvents,
  demoViewerBuckets,
} from "../home/demo-data";

/*
 * The viewer line with its events on it, alive: the sparkline draws in, then
 * one marker lights at a time while the rest dim, with a readout naming what
 * the lit dot is (the event strip's cycle, on the graph instead of the
 * timeline). Clicking a dot holds it for ten seconds before the cycle may
 * drag it along again. Offsets come from the demo stream's own arrays and
 * colors are EVENT_TYPE_CONFIG's classes, so the dots cannot drift from the
 * chart the band above renders.
 */

const STEP_MS = 3200;
/** How long a hand-picked marker holds before the cycle may drag it along again. */
const MARKER_HOLD_MS = 10000;
/** How long the wipe takes to cross the whole clock, left edge to right. */
const DRAW_MS = 1.1;

const PEAK = Math.max(...demoViewerBuckets.map((bucket) => bucket.viewers));

/** 0..100 across the 4h 12m clock. */
function xFor(offsetSeconds: number): number {
  return (offsetSeconds / DEMO_VOD_DURATION_SECONDS) * 100;
}

/** SVG y in a 0..40 viewBox, 10% headroom top and bottom. */
function yFor(viewers: number): number {
  return 36 - (viewers / PEAK) * 32;
}

function viewersAt(offsetSeconds: number): number {
  for (let i = 1; i < demoViewerBuckets.length; i++) {
    if (offsetSeconds <= demoViewerBuckets[i].bucket) {
      const a = demoViewerBuckets[i - 1];
      const b = demoViewerBuckets[i];
      const fraction = (offsetSeconds - a.bucket) / (b.bucket - a.bucket);
      return a.viewers + (b.viewers - a.viewers) * fraction;
    }
  }
  return demoViewerBuckets[demoViewerBuckets.length - 1].viewers;
}

function formatOffset(offsetSeconds: number): string {
  const h = Math.floor(offsetSeconds / 3600);
  const m = Math.floor((offsetSeconds % 3600) / 60);
  const s = offsetSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const LINE_D = demoViewerBuckets
  .map((bucket, i) => `${i === 0 ? "M" : "L"}${xFor(bucket.bucket).toFixed(2)} ${yFor(bucket.viewers).toFixed(2)}`)
  .join(" ");
const AREA_D = `${LINE_D} L${xFor(demoViewerBuckets[demoViewerBuckets.length - 1].bucket).toFixed(2)} 40 L0 40 Z`;

const raidEvent = demoActivityEvents.find((event) => event.event_type === "channel.raid");
const redemptionEvent = demoActivityEvents.find((event) =>
  event.event_type.includes("redemption"),
);

interface DemoMarker {
  key: string;
  /** Tailwind background class, matching EVENT_TYPE_CONFIG. */
  color: string;
  offsetSeconds: number;
  label: string;
  /** One line for the readout while this marker is lit. */
  blurb: string;
}

const MARKERS: DemoMarker[] = [
  {
    key: "follow",
    color: "bg-blue-500",
    offsetSeconds: demoFollowEvents[1].offsetSeconds,
    label: "Follow",
    blurb: "Pinned to the minute it landed.",
  },
  {
    key: "sub",
    color: "bg-purple-500",
    offsetSeconds: demoSubEvents[0].offsetSeconds,
    label: "Sub",
    blurb: "Tier and all, right on the line.",
  },
  {
    key: "raid",
    color: "bg-indigo-500",
    offsetSeconds: raidEvent?.offset_seconds ?? 7800,
    label: "Raid",
    blurb: "mossy_vt walked in with 62. There's the spike.",
  },
  {
    key: "clip",
    color: "bg-teal-500",
    offsetSeconds: demoClips[0].vod_offset ?? 0,
    label: "Clip",
    blurb: "“The 1v4 that saved the run”, cut where the line jumped.",
  },
  {
    key: "redemption",
    color: "bg-cyan-500",
    offsetSeconds: redemptionEvent?.offset_seconds ?? 9000,
    label: "Redemption",
    blurb: "sleepy_sre redeemed Hydrate. Break clip, found.",
  },
];

export function ViewerEventsDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });
  const track = useDemoTracking("analytics_graph");
  /* useId's own format carries characters a url(#…) reference cannot hold. */
  const clipId = `viewer-events-wipe-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const [step, setStep] = useState(0);
  const [override, setOverride] = useState<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => {
      setStep((current) => (current + 1) % MARKERS.length);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [inView]);

  /** Hold a hand-picked marker so the cycle does not yank the readout away mid-read. */
  const pickMarker = (index: number) => {
    track(`marker_${MARKERS[index].key}`);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setOverride(index);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setOverride(null);
    }, MARKER_HOLD_MS);
  };

  const activeIdx = override ?? step;
  const active = MARKERS[activeIdx];

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        className="mx-auto mb-12 max-w-3xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"
      >
        <div className="relative h-32 overflow-hidden rounded-md bg-white/[0.04]">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/*
             * The line draws in as a left-to-right wipe, not a pathLength dash:
             * this viewBox is stretched non-uniformly (preserveAspectRatio="none"),
             * so dash lengths — normalised in user units, stroked in device units —
             * do not track the line you can actually see. A clip rect has no such
             * mismatch, and reads as the clock sweeping anyway.
             */}
            <defs>
              <clipPath id={clipId}>
                <motion.rect
                  x={0}
                  y={0}
                  height={40}
                  initial={{ width: 0 }}
                  whileInView={{ width: 100 }}
                  viewport={{ once: true, margin: "-64px" }}
                  transition={{ duration: DRAW_MS, ease: "easeOut" }}
                />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <path d={AREA_D} className="fill-purple-500/10" />
              <path
                d={LINE_D}
                className="stroke-purple-400/80"
                fill="none"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </svg>
          {MARKERS.map((marker, index) => (
            /* Each dot lands as the wipe reaches its minute, so nothing floats
               over a line that has not been drawn there yet. */
            <motion.button
              key={marker.key}
              type="button"
              aria-pressed={activeIdx === index}
              aria-label={`${marker.label} at ${formatOffset(marker.offsetSeconds)}`}
              onClick={() => pickMarker(index)}
              className={cn(
                "absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-1 focus-visible:ring-purple-300/70",
                activeIdx === index ? "z-20" : "z-10",
              )}
              style={{
                left: `${xFor(marker.offsetSeconds)}%`,
                top: `${(yFor(viewersAt(marker.offsetSeconds)) / 40) * 100}%`,
              }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-64px" }}
              transition={{
                duration: 0.3,
                ease: "easeOut",
                delay: (xFor(marker.offsetSeconds) / 100) * DRAW_MS,
              }}
            >
              <motion.span
                className={cn("block h-2.5 w-2.5 rounded-full", marker.color)}
                animate={{
                  opacity: activeIdx === index ? 1 : 0.25,
                  scale: activeIdx === index ? 1.3 : 1,
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </motion.button>
          ))}
        </div>

        {/* Readout: what the lit dot is. Fixed height so steps cannot shift the layout. */}
        <div className="mt-3 flex h-5 items-center justify-center gap-2 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex min-w-0 items-center gap-2"
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", active.color)} aria-hidden="true" />
              <p className="truncate text-sm text-muted-foreground">
                <span className="font-mono text-xs text-foreground">
                  {active.label} · {formatOffset(active.offsetSeconds)}
                </span>
                <span className="ml-2 hidden sm:inline">{active.blurb}</span>
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
