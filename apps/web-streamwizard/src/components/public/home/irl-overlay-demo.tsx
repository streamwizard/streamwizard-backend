"use client";

import { useEffect, useRef, useState } from "react";
import { useDemoTracking } from "../analytics/use-demo-tracking";
import { MotionConfig, motion, useInView } from "motion/react";
import { cn } from "@repo/ui";
import { MonitorPlay, Smartphone, Wand2 } from "lucide-react";
import { DemoAlertBox, useDemoAlertFrameRef, useDemoAlerts } from "./overlay-demo-alert";

/*
 * What a viewer sees on an IRL stream with a StreamWizard overlay on it: the
 * Walking Stats bar along the bottom (speed, distance, city, weather from the
 * phone's GPS), two single-value IRL widgets in a corner, a time widget, and
 * the alert box firing now and then.
 *
 * Drawn to the real widgets' defaults (Inter, #b9b9c6 labels, 45% black bar,
 * #9e7aff alert accent) but wired to nothing: a walk someone scripted, not a
 * live socket. Every number starts from a fixed value so server and client
 * paint the same first frame; the jitter only begins in effects.
 */

type Units = "metric" | "imperial";

interface Walk {
  speedKmh: number;
  distanceKm: number;
  headingDeg: number;
  altitudeM: number;
  clockSec: number;
}

const START: Walk = {
  speedKmh: 4.8,
  distanceKm: 3.57,
  headingDeg: 212,
  altitudeM: 14,
  clockSec: 19 * 3600 + 42 * 60 + 5,
};

const TEMP_C = 21;
const WEATHER = "Partly cloudy"; // WMO code 2, what Open-Meteo returns for it
const CITY = "Haarlem, North Holland";

const TICK_MS = 1000;

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
function compass(deg: number) {
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return COMPASS[idx];
}

function clockLabel(sec: number) {
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((p) => String(p).padStart(2, "0")).join(":");
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** One module of the Walking Stats bar: small label above, value beside its unit. */
function BarModule({
  label,
  value,
  unit,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <span className="text-[7px] font-semibold uppercase tracking-[0.18em] text-[#b9b9c6] @md:text-[9px] @xl:text-[11px]">
        {label}
      </span>
      <span className="truncate text-[12px] font-bold leading-tight text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] @md:text-lg @xl:text-2xl">
        {value}
        {unit ? (
          <span className="ml-0.5 text-[7px] font-medium text-[#b9b9c6] @md:ml-1 @md:text-[10px] @xl:text-xs">
            {unit}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** A single-value IRL widget (heading, altitude) as it sits in a corner. */
function CornerField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-end gap-1.5">
      <span className="text-[6px] font-semibold uppercase tracking-[0.18em] text-[#b9b9c6] @md:text-[8px] @xl:text-[10px]">
        {label}
      </span>
      <span className="text-[10px] font-semibold text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] @md:text-sm @xl:text-base">
        {value}
      </span>
    </div>
  );
}

function UnitToggle({ units, onChange }: { units: Units; onChange: (u: Units) => void }) {
  const options: { value: Units; label: string }[] = [
    { value: "metric", label: "km/h · km · °C" },
    { value: "imperial", label: "mph · mi · °F" },
  ];
  return (
    <div
      role="group"
      aria-label="Unit system"
      className="flex rounded-md border border-white/[0.08] bg-white/[0.03] p-0.5 font-mono text-[10px] uppercase tracking-widest"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={units === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded px-2 py-1 transition-colors",
            units === opt.value ? "bg-purple-500/15 text-purple-300" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function IrlOverlayDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });

  const [units, setUnits] = useState<Units>("metric");
  const [walk, setWalk] = useState<Walk>(START);
  const track = useDemoTracking("irl_overlay");
  const alertPlay = useDemoAlerts(inView);
  const frameRef = useDemoAlertFrameRef();

  // The walk: one GPS fix a second while the demo is on screen.
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => {
      setWalk((w) => {
        const speedKmh = clamp(w.speedKmh + (Math.random() - 0.5) * 0.7, 3.4, 6.4);
        return {
          speedKmh,
          distanceKm: w.distanceKm + speedKmh / 3600,
          headingDeg: w.headingDeg + (Math.random() - 0.5) * 4,
          altitudeM: clamp(w.altitudeM + (Math.random() - 0.5) * 0.6, 8, 22),
          clockSec: w.clockSec + 1,
        };
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [inView]);

  const imperial = units === "imperial";
  const speed = imperial ? walk.speedKmh * 0.621371 : walk.speedKmh;
  const distance = imperial ? walk.distanceKm * 0.621371 : walk.distanceKm;
  const temp = imperial ? Math.round((TEMP_C * 9) / 5 + 32) : TEMP_C;

  return (
    <div ref={rootRef} className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2 shadow-[0_16px_48px_-16px_rgba(158,122,255,0.25)] sm:p-3">
        {/* Header row: what this frame is, and the one control visitors get. */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 sm:mb-3">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" />
            Browser source · 1920×1080
          </p>
          <UnitToggle
            units={units}
            onChange={(next) => {
              track(`units_${next}`);
              setUnits(next);
            }}
          />
        </div>

        {/* The program output. Container queries size the overlay text to the
            frame, not the viewport, so it reads the same in a 340px card and a
            900px one. */}
        <MotionConfig reducedMotion="user">
          <div
            role="img"
            aria-label="An IRL stream with StreamWizard overlays on it: a bar along the bottom showing walking speed, distance, the city, and the weather from the phone's GPS, the time in a corner, and alerts popping in"
            ref={frameRef}
            className="@container relative aspect-video scroll-mt-24 select-none overflow-hidden rounded-lg bg-black"
          >
            <div aria-hidden="true" className="absolute inset-0">
              {/* The camera feed: the same evening-street gradient the IRL
                  scene uses in the OBS window above, with a slow drift so it
                  reads as footage rather than a still. */}
              <div className="absolute inset-0 bg-[linear-gradient(160deg,#1b2440_0%,#2a1c3d_55%,#12161f_100%)]" />
              <motion.div
                className="absolute -inset-x-[10%] inset-y-0 bg-[radial-gradient(circle_at_30%_40%,rgba(158,122,255,0.35),transparent_55%),radial-gradient(circle_at_75%_70%,rgba(255,189,122,0.22),transparent_50%)]"
                animate={{ x: ["0%", "6%", "0%"] }}
                transition={{ duration: 14, ease: "easeInOut", repeat: Infinity }}
              />
              <div className="absolute inset-x-0 bottom-[15%] h-px bg-white/[0.06]" />

              {/* Time widget, top left */}
              <div className="absolute left-[3%] top-[5%] text-[10px] font-semibold text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] @md:text-sm @xl:text-base">
                {clockLabel(walk.clockSec)}
              </div>

              {/* Single-value IRL widgets, top right */}
              <div className="absolute right-[3%] top-[5%] space-y-0.5 @md:space-y-1">
                <CornerField label="Heading" value={`${Math.round(walk.headingDeg)}° ${compass(walk.headingDeg)}`} />
                <CornerField label="Altitude" value={`${Math.round(walk.altitudeM)} m`} />
              </div>

              {/* Alert box, upper middle */}
              {/* Sits lower on a small frame so it clears the corner widgets. */}
              <div className="absolute inset-x-[8%] top-[34%] flex justify-center @md:inset-x-[12%] @md:top-[18%]">
                <DemoAlertBox play={alertPlay} />
              </div>

              {/* Walking Stats bar, slid in from the bottom like the real one */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                className="absolute inset-x-0 bottom-0 flex h-[15%] items-center gap-[4%] bg-black/45 px-[3%] @md:gap-[5%]"
              >
                <BarModule label="Speed" value={speed.toFixed(1)} unit={imperial ? "mph" : "km/h"} />
                <BarModule label="Distance" value={distance.toFixed(2)} unit={imperial ? "mi" : "km"} />
                <BarModule label="Location" value={CITY} className="hidden @sm:flex" />
                <BarModule label="Weather" value={`${temp}°`} unit={WEATHER} className="ml-auto items-end text-right" />
              </motion.div>
            </div>
          </div>
        </MotionConfig>
      </div>

      <GpsFlow />
    </div>
  );
}

/*
 * How the numbers get there. Three stops and two wires, with a fix travelling
 * along them: the phone reads GPS and opens the overlay, the widget turns fixes
 * into distance, city, and weather, and OBS shows the result in one browser
 * source. No app on the phone, no extra hardware.
 */
function FlowNode({ icon: Icon, title, body }: { icon: typeof Smartphone; title: string; body: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
        <Icon className="h-4 w-4 text-purple-300" aria-hidden="true" />
      </span>
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function FlowWire({ delay }: { delay: number }) {
  return (
    <div aria-hidden="true" className="relative mt-4 hidden h-px w-16 shrink-0 bg-white/[0.1] sm:block lg:w-24">
      <MotionConfig reducedMotion="user">
        <motion.span
          className="absolute -top-[3px] left-0 h-[7px] w-[7px] rounded-full bg-purple-400 shadow-[0_0_8px_rgba(158,122,255,0.9)]"
          animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.8, delay }}
        />
      </MotionConfig>
    </div>
  );
}

function GpsFlow() {
  return (
    <div className="mt-8 flex flex-col items-start justify-center gap-6 sm:flex-row sm:items-start sm:gap-4">
      <FlowNode
        icon={Smartphone}
        title="Your phone"
        body="Open the overlay on the phone you stream from. It reads the GPS. No extra hardware."
      />
      <FlowWire delay={0} />
      <FlowNode
        icon={Wand2}
        title="StreamWizard"
        body="Every fix becomes speed, distance, the city you are in, and the weather there."
      />
      <FlowWire delay={1.2} />
      <FlowNode
        icon={MonitorPlay}
        title="OBS"
        body="One browser source shows it all. Cloud OBS, or the OBS on your PC."
      />
    </div>
  );
}
