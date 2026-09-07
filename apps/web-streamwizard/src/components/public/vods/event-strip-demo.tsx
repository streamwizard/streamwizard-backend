"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView, useReducedMotion } from "motion/react";
import { ZoomIn } from "lucide-react";
import { cn } from "@repo/ui";
import { useDemoTracking } from "../analytics/use-demo-tracking";
import { DEMO_VOD_DURATION_SECONDS, demoEventStripTypes } from "../home/demo-data";

/*
 * The timeline sketch, alive: one event type lit at a time while the rest
 * dim, a readout naming what the lit dots are, and a zoom beat that spreads
 * the raid cluster to 20x. The cycle runs itself and pauses off screen;
 * clicking a chip holds that type for ten seconds before the cycle may drag
 * it along again (the alert box playground's hold rule). Dot colors are
 * EVENT_TYPE_CONFIG's classes via demoEventStripTypes, so the strip cannot
 * drift from the product.
 */

const STEP_MS = 3200;
/** How long a hand-picked chip holds before the cycle may drag it along again. */
const CHIP_HOLD_MS = 10000;
const ZOOM = 20;
/** The raid cluster at ~2:10:00 sits here; the zoom beat spreads around it. */
const ZOOM_ORIGIN = "52% 50%";
const ZOOM_STEP = demoEventStripTypes.length;
const STEP_COUNT = ZOOM_STEP + 1;

export function EventStripDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });
  const reducedMotion = useReducedMotion();
  const track = useDemoTracking("vods_events");

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
      setStep((current) => {
        const next = (current + 1) % STEP_COUNT;
        /* Reduced motion skips the zoom beat: a 20x scale that cannot animate
         * would snap instead of spread. Decided post-hydration, after inView
         * flips, so the first render is identical on server and client. */
        return reducedMotion && next === ZOOM_STEP ? 0 : next;
      });
    }, STEP_MS);
    return () => clearInterval(id);
  }, [inView, reducedMotion]);

  /** Hold a hand-picked chip so the cycle does not yank the readout away mid-read. */
  const pickChip = (index: number) => {
    track(`chip_${demoEventStripTypes[index].key}`);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setOverride(index);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setOverride(null);
    }, CHIP_HOLD_MS);
  };

  const activeIdx = override ?? (step === ZOOM_STEP ? null : step);
  const zoomed = override === null && step === ZOOM_STEP;
  const active = activeIdx === null ? null : demoEventStripTypes[activeIdx];

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        className="mx-auto mb-12 max-w-3xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"
      >
        <div className="relative h-12 overflow-hidden rounded-md bg-white/[0.04]" aria-hidden="true">
          <motion.div
            className="absolute inset-0"
            style={{ transformOrigin: ZOOM_ORIGIN }}
            animate={{ scaleX: zoomed ? ZOOM : 1 }}
            transition={{ duration: 1.1, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Watched fill, as the sketch drew it */}
            <div className="absolute inset-y-0 left-0 w-[46%] bg-purple-500/25" />
            {/* One muted stretch, striped like the real track */}
            <div
              className="absolute inset-y-0 left-[32%] w-[7%] border-x border-red-600/60 bg-red-500/40"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(248,113,113,0.5) 2px, rgba(248,113,113,0.5) 4px)",
              }}
            />
            <motion.div
              className="absolute inset-y-0 left-[46%] w-px bg-white"
              animate={{ scaleX: zoomed ? 1 / ZOOM : 1 }}
              transition={{ duration: 1.1, ease: [0.32, 0.72, 0, 1] }}
            />
            {demoEventStripTypes.map((type, index) =>
              type.offsets.map((offset) => (
                <motion.div
                  key={`${type.label}-${offset}`}
                  className={cn("absolute top-1/2 -mt-[5px] h-2.5 w-2.5 rounded-full", type.color)}
                  style={{ left: `${(offset / DEMO_VOD_DURATION_SECONDS) * 100}%` }}
                  animate={{
                    opacity: zoomed || activeIdx === index ? 1 : 0.2,
                    scaleX: zoomed ? 1 / ZOOM : 1,
                  }}
                  transition={{
                    opacity: { duration: 0.4 },
                    /* Counter-scale must ride the parent's exact curve or the
                     * dots smear into dashes mid-zoom. */
                    scaleX: { duration: 1.1, ease: [0.32, 0.72, 0, 1] },
                  }}
                />
              )),
            )}
          </motion.div>
        </div>

        {/* Readout: what the lit dots are. Fixed height so steps cannot shift the layout. */}
        <div className="mt-3 flex h-5 items-center justify-center gap-2 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={zoomed ? "zoom" : (active?.label ?? "idle")}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex min-w-0 items-center gap-2"
            >
              {zoomed ? (
                <>
                  <ZoomIn className="size-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                  <p className="truncate text-sm text-muted-foreground">
                    <span className="font-mono text-xs text-foreground">Zoom &middot; 20x</span>
                    <span className="ml-2 hidden sm:inline">Seconds get room.</span>
                  </p>
                </>
              ) : active ? (
                <>
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", active.color)} aria-hidden="true" />
                  <p className="truncate text-sm text-muted-foreground">
                    <span className="font-mono text-xs text-foreground">
                      {active.label} · {active.offsets.length}
                    </span>
                    <span className="ml-2 hidden sm:inline">{active.blurb}</span>
                  </p>
                </>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {demoEventStripTypes.map((type, index) => (
            <button
              key={type.label}
              type="button"
              aria-pressed={activeIdx === index}
              onClick={() => pickChip(index)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-px font-mono text-[10px] transition-colors",
                activeIdx === index
                  ? "border-white/25 bg-white/[0.08] text-foreground"
                  : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", type.color)} aria-hidden="true" />
              {type.label}
            </button>
          ))}
        </div>
      </div>
    </MotionConfig>
  );
}
