"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@repo/ui";
import { useDemoTracking } from "./use-demo-tracking";
import { demoFeedRows } from "../home/demo-data";

/*
 * The feed's filter claim, acted out: the chips are ActivityFeedClient's
 * real FILTERS, the rows are the demo stream's raid window, and picking a
 * chip cuts the list down to just that type (popLayout springs, the library
 * demo's exits). The cycle walks the chips itself and pauses off screen;
 * clicking one holds it for ten seconds before the cycle may drag it along
 * again. Reduced motion keeps the chips clickable and stops only the
 * auto-cycle. First frame is "All", the full window at rest.
 */

const STEP_MS = 3000;
/** How long a hand-picked chip holds before the cycle may drag it along again. */
const CHIP_HOLD_MS = 10000;

/** ActivityFeedClient's real filter list, "All" included. */
const FILTERS = ["All", "Follows", "Subs", "Bits", "Raids", "Rewards", "Updates"] as const;

function formatOffset(offsetSeconds: number): string {
  const h = Math.floor(offsetSeconds / 3600);
  const m = Math.floor((offsetSeconds % 3600) / 60);
  const s = offsetSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ActivityFeedDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });
  const reducedMotion = useReducedMotion();
  const track = useDemoTracking("analytics_feed");

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
    if (!inView || reducedMotion) return;
    const id = setInterval(() => {
      setStep((current) => (current + 1) % FILTERS.length);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [inView, reducedMotion]);

  /** Hold a hand-picked chip so the cycle does not yank the list away mid-read. */
  const pickFilter = (index: number) => {
    track(`filter_${FILTERS[index].toLowerCase()}`);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setOverride(index);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setOverride(null);
    }, CHIP_HOLD_MS);
  };

  const activeIdx = override ?? step;
  const activeFilter = FILTERS[activeIdx];
  const rows =
    activeFilter === "All"
      ? demoFeedRows
      : demoFeedRows.filter((row) => row.filter === activeFilter);

  return (
    <MotionConfig reducedMotion="user">
      <div ref={rootRef} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        {/* Window chrome, as the library demo wears it */}
        <div className="flex items-center gap-2 border-b border-white/[0.08] px-3 py-2">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
          </span>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            streamwizard.org/dashboard/analytics
          </span>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-white/[0.08] p-3">
          {FILTERS.map((label, index) => (
            <button
              key={label}
              type="button"
              aria-pressed={activeIdx === index}
              onClick={() => pickFilter(index)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-purple-300/70",
                activeIdx === index
                  ? "border-purple-400/30 bg-purple-400/[0.08] text-purple-200"
                  : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-[288px] p-2" aria-hidden="true">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((row, index) => (
              <motion.div
                key={row.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ type: "spring", stiffness: 300, damping: 30, delay: index * 0.05 }}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
              >
                <span className={cn("size-2 shrink-0 rounded-full", row.color)} />
                <span className="w-24 shrink-0 truncate font-mono text-[10px] text-muted-foreground sm:w-28">
                  {row.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs">{row.detail}</span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {formatOffset(row.offsetSeconds)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
