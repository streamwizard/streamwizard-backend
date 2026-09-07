"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@repo/ui";
import { demoVodLibraryRows } from "../home/demo-data";

/*
 * The VOD library as a looped vignette: the list at rest, five archived rows
 * get checked one by one, the batch delete sweeps them out, and a refresh
 * springs them back. The live row never joins the selection, because Twitch
 * will not delete a running broadcast. Scripted in the sync-timeline shape,
 * first frame is the full list at rest so SSR and reduced motion share the
 * same still (react-compiler: no setState in effect bodies, only in timer
 * callbacks).
 */

type Phase = "rest" | "select" | "delete" | "refill";

const ORDER: Phase[] = ["rest", "select", "delete", "refill"];
const CHECK_TICK_MS = 450;
const ARCHIVED = demoVodLibraryRows.filter((row) => !row.live);
/* Rows with their position among the archived ones, for tick order and stagger. */
const ROWS = demoVodLibraryRows.map((row) => ({
  ...row,
  archivedIndex: row.live ? -1 : ARCHIVED.findIndex((archived) => archived.id === row.id),
}));
const HOLD_MS: Record<Phase, number> = {
  rest: 2200,
  select: ARCHIVED.length * CHECK_TICK_MS + 1200,
  delete: 1600,
  refill: 2600,
};

const STATUS: Record<Phase, string> = {
  rest: `${demoVodLibraryRows.length} broadcasts · 1 live`,
  select: "",
  delete: "Deleting 5 VODs…",
  refill: "Refreshed from Twitch.",
};

export function VodLibraryDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("rest");
  const [checkedCount, setCheckedCount] = useState(0);

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const next = ORDER[(ORDER.indexOf(phase) + 1) % ORDER.length];
    const timer = setTimeout(() => {
      if (phase === "refill") setCheckedCount(0);
      setPhase(next);
    }, HOLD_MS[phase]);
    return () => clearTimeout(timer);
  }, [phase, inView, reducedMotion]);

  useEffect(() => {
    if (phase !== "select" || !inView) return;
    const id = setInterval(() => {
      setCheckedCount((count) => (count >= ARCHIVED.length ? count : count + 1));
    }, CHECK_TICK_MS);
    return () => clearInterval(id);
  }, [phase, inView]);

  const status =
    phase === "select"
      ? checkedCount >= ARCHIVED.length
        ? "5 of 5. Twitch's limit, not ours."
        : `${checkedCount} of ${ARCHIVED.length} selected`
      : STATUS[phase];

  return (
    <MotionConfig reducedMotion="user">
      <div ref={rootRef} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        {/* Window chrome, as the timeline demo wears it */}
        <div className="flex items-center gap-2 border-b border-white/[0.08] px-3 py-2">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
          </span>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            streamwizard.org/dashboard/vods
          </span>
        </div>

        <div className="min-h-[248px] p-2" aria-hidden="true">
          <AnimatePresence initial={false} mode="popLayout">
            {ROWS.map((row) => {
              const index = row.archivedIndex;
              if (!row.live && phase === "delete") return null;
              const checked = !row.live && phase !== "refill" && index < checkedCount;
              return (
                <motion.div
                  key={row.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    delay: row.live ? 0 : index * 0.07,
                  }}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
                >
                  <span
                    className={cn(
                      "flex size-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors duration-200",
                      checked ? "border-amber-400 bg-amber-400/90" : "border-white/20 bg-transparent",
                      row.live && "opacity-30",
                    )}
                  >
                    {checked && <Check className="size-2.5 text-zinc-900" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs">{row.title}</span>
                  {row.live ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-px font-mono text-[10px] uppercase tracking-widest text-red-300">
                      <span className="size-1.5 rounded-full bg-red-400 animate-pulse motion-reduce:animate-none" />
                      Live
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {row.recordedLabel}
                    </span>
                  )}
                  <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                    {row.duration}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="flex h-11 items-center justify-between border-t border-white/[0.08] px-3">
          {/* Opacity-only: this remounts on every count-up tick, and five
           * y-rises in a row would read as popping. */}
          <motion.p
            key={status}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn(
              "truncate text-xs",
              phase === "select" && checkedCount >= ARCHIVED.length
                ? "text-amber-200"
                : "text-muted-foreground",
            )}
          >
            {status}
          </motion.p>
          <motion.div
            initial={false}
            animate={{
              scale: phase === "delete" ? 0.94 : 1,
              opacity: checkedCount > 0 && phase !== "refill" ? 1 : 0.35,
            }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            className="shrink-0 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs text-red-300"
            aria-hidden="true"
          >
            Delete{checkedCount > 0 && phase !== "refill" ? ` (${checkedCount})` : ""}
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  );
}
