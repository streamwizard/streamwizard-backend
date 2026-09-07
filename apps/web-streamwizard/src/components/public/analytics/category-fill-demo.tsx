"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@repo/ui";
import { demoCategorySegments, DEMO_VOD_DURATION_SECONDS } from "../home/demo-data";

/*
 * The category table as a looped vignette: a progress fill sweeps the 4h 12m
 * clock, the row whose category is on air highlights, the split marker pings
 * where the category changed, and the rest phase makes the credit claim.
 * Scripted in the sync-timeline shape, first frame is the finished stream at
 * rest (fill full, both rows, credit caption) so SSR and reduced motion share
 * the same still (react-compiler: no setState in effect bodies, only in
 * timer callbacks). Rows come from demoCategorySegments, so the table cannot
 * drift from the one the band above renders.
 */

type Phase = "rest" | "game" | "switch" | "chatting";

const ORDER: Phase[] = ["rest", "game", "switch", "chatting"];
const HOLD_MS: Record<Phase, number> = {
  rest: 3000,
  game: 3200,
  switch: 1600,
  chatting: 2400,
};

const [GAME, CHATTING] = demoCategorySegments;
/** Where the category changed on the 0..1 clock: 9600 / 15120. The type
 * allows a null end for a still-running segment; the demo stream's is set. */
const SPLIT = (GAME.endSeconds ?? GAME.durationSeconds) / DEMO_VOD_DURATION_SECONDS;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

const CAPTIONS: Record<Phase, string> = {
  rest: "The raid at 2:10:00 counts for Elden Ring. Nothing bleeds over.",
  game: `${GAME.gameName} · ${formatDuration(GAME.durationSeconds)} on the clock`,
  switch: "Category changed at 2:40:00. The stats split here.",
  chatting: `${CHATTING.gameName} · its own row, its own numbers`,
};

/** Which row is on air during a phase; null when none is highlighted. */
const ACTIVE_ROW: Record<Phase, number | null> = {
  rest: null,
  game: 0,
  switch: null,
  chatting: 1,
};

const ROWS = demoCategorySegments.map((segment) => ({
  key: segment.gameId,
  name: segment.gameName,
  duration: formatDuration(segment.durationSeconds),
  avg: String(segment.avgViewers),
  peak: String(segment.peakViewers),
}));

export function CategoryFillDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("rest");

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const next = ORDER[(ORDER.indexOf(phase) + 1) % ORDER.length];
    const timer = setTimeout(() => setPhase(next), HOLD_MS[phase]);
    return () => clearTimeout(timer);
  }, [phase, inView, reducedMotion]);

  /* Keyframe arrays restart the sweep from its phase's own start, so the
   * fill never runs backwards when the loop wraps from full to empty. */
  const fillAnimate =
    phase === "game"
      ? { scaleX: [0, SPLIT] }
      : phase === "chatting"
        ? { scaleX: [SPLIT, 1] }
        : { scaleX: phase === "switch" ? SPLIT : 1 };
  const fillTransition =
    phase === "game" || phase === "chatting"
      ? { duration: HOLD_MS[phase] / 1000, ease: "linear" as const }
      : { duration: 0.3, ease: "easeOut" as const };

  const activeRow = ACTIVE_ROW[phase];

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        className="mx-auto mb-12 max-w-lg rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"
      >
        {/* The stream clock: fill sweeps, the split marker is where the category changed. */}
        <div className="relative mb-4 h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
          <motion.div
            className="absolute inset-0 origin-left rounded-full bg-purple-500/40"
            initial={false}
            animate={fillAnimate}
            transition={fillTransition}
          />
          {/* Channel Update's slate, as EVENT_TYPE_CONFIG colors it. */}
          <motion.span
            className="absolute inset-y-0 w-px bg-slate-400"
            style={{ left: `${SPLIT * 100}%` }}
            animate={{ scaleX: phase === "switch" ? [1, 3, 1] : 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        <div className="space-y-2" aria-hidden="true">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-2 font-mono text-[10px] text-muted-foreground">
            <span>Category</span>
            <span>Duration</span>
            <span>Avg</span>
            <span>Peak</span>
          </div>
          {ROWS.map(({ key, name, duration, avg, peak }, index) => (
            <div
              key={key}
              className={cn(
                "grid grid-cols-[1fr_auto_auto_auto] gap-x-4 rounded-md px-2 py-1.5 text-xs transition-colors duration-300",
                activeRow === index
                  ? "bg-purple-500/[0.08] ring-1 ring-purple-400/30"
                  : "bg-white/[0.04]",
              )}
            >
              <span className="font-medium">{name}</span>
              <span className="font-mono text-muted-foreground">{duration}</span>
              <span className="font-mono text-muted-foreground">{avg}</span>
              <span className="font-mono text-muted-foreground">{peak}</span>
            </div>
          ))}
        </div>

        {/* Caption: fixed height so phases cannot shift the layout. */}
        <div className="mt-3 flex h-5 items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={phase === "rest" ? "rest" : phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="truncate font-mono text-[10px] text-muted-foreground"
            >
              {CAPTIONS[phase]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
