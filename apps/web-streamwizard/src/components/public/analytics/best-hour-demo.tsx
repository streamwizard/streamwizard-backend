"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView } from "motion/react";
import { cn } from "@repo/ui";
import { useDemoTracking } from "./use-demo-tracking";
import { demoHourlyStats } from "../home/demo-data";

/*
 * The hourly bars, alive: the scan lights one hour at a time with its
 * numbers in the readout, then lands on the winner with the verdict pill —
 * explainBestHour's "most viewers and most chat", not just a highlighted
 * bar. Clicking a bar holds that hour for ten seconds. First frame is the
 * verdict (best hour lit, pill shown), the same still the old sketch drew,
 * so SSR and reduced motion share it.
 */

const STEP_MS = 2600;
/** How long a hand-picked bar holds before the scan may drag it along again. */
const BAR_HOLD_MS = 10000;

const HOURS = demoHourlyStats;
const PEAK_AVG = Math.max(...HOURS.map((hour) => hour.avgViewers));
const BEST_INDEX = HOURS.findIndex((hour) => hour.isBestHour);
/** Steps 0..3 scan the hours; the last step is the verdict. */
const VERDICT_STEP = HOURS.length;
const STEP_COUNT = HOURS.length + 1;

export function BestHourDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });
  const track = useDemoTracking("analytics_best_hour");

  const [step, setStep] = useState(VERDICT_STEP);
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
      setStep((current) => (current + 1) % STEP_COUNT);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [inView]);

  /** Hold a hand-picked hour so the scan does not yank the readout away mid-read. */
  const pickHour = (index: number) => {
    track(`hour_${index + 1}`);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setOverride(index);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setOverride(null);
    }, BAR_HOLD_MS);
  };

  const verdict = override === null && step === VERDICT_STEP;
  const activeIdx = override ?? (verdict ? BEST_INDEX : step);
  const activeHour = HOURS[activeIdx];

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        className="mx-auto mb-12 max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"
      >
        <div className="flex h-24 items-end justify-center gap-3">
          {HOURS.map((hour, index) => (
            <button
              key={hour.hour}
              type="button"
              aria-pressed={activeIdx === index}
              aria-label={`Hour ${index + 1}: ${hour.avgViewers} average viewers, ${hour.peakViewers} peak, ${hour.totalInteractions} interactions`}
              onClick={() => pickHour(index)}
              className="flex h-full w-10 items-end rounded-t-md outline-none focus-visible:ring-1 focus-visible:ring-purple-300/70"
            >
              <motion.span
                className={cn(
                  "block w-full origin-bottom rounded-t-md transition-colors duration-300",
                  activeIdx === index ? "bg-purple-500/70" : "bg-white/[0.08]",
                )}
                style={{ height: `${(hour.avgViewers / PEAK_AVG) * 100}%` }}
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true, margin: "-64px" }}
                transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.07 }}
              />
            </button>
          ))}
        </div>

        {/* Readout: the lit hour's numbers, or the verdict. Fixed height so steps cannot shift the layout. */}
        <div className="mt-3 flex h-6 items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={verdict ? "verdict" : `hour-${activeIdx}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {verdict ? (
                <span className="rounded-full border border-purple-400/30 bg-purple-400/[0.08] px-2 py-px font-mono text-[10px] text-purple-200">
                  hour {BEST_INDEX + 1} · most viewers and most chat
                </span>
              ) : (
                <span className="font-mono text-[10px] text-muted-foreground">
                  hour {activeIdx + 1} · avg {activeHour.avgViewers} · peak{" "}
                  {activeHour.peakViewers} · {activeHour.totalInteractions} interactions
                </span>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
