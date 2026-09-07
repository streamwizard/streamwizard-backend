"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView, useReducedMotion } from "motion/react";
import { CircleCheck, GripVertical, Scissors } from "lucide-react";
import { cn } from "@repo/ui";
import { demoClips } from "../home/demo-data";

/*
 * The three clip-creation steps, staged as a loop on a zoomed-in stretch of
 * the demo VOD (about 90 seconds around the raid): the context menu opens,
 * the selection springs out to the product's real "Clip: 42s (5s - 60s)"
 * readout, playback loops it, a name goes in, Save fires the store's real
 * toast, and the clip comes back as a teal dot. Numbered rail alongside
 * follows the phase. Scripted vignette in the sync-timeline shape; no
 * controls, so nothing here reports to useDemoTracking (react-compiler: no
 * setState in effect bodies, only in timer callbacks).
 *
 * The selection overlay stays the dashboard's purple on the amber page: the
 * demo mirrors the product, and the product's selection is purple.
 */

type Phase = "select" | "loop" | "name" | "save" | "hold" | "idle" | "menu";

const ORDER: Phase[] = ["select", "loop", "name", "save", "hold", "idle", "menu"];
const HOLD_MS: Record<Phase, number> = {
  select: 2400,
  loop: 2800,
  name: 2000,
  save: 1400,
  hold: 2600,
  idle: 1000,
  menu: 1800,
};

/* The zoomed window: 2:09:41 to 2:11:12, selection 2:10:04 to 2:10:46. */
const SELECTION_LEFT = "25.3%";
const SELECTION_WIDTH = "46.2%";

const STEPS = [
  {
    title: "Start where the moment is",
    body: "Right-click the timeline and hit Create Clip Here, or press the Create Clip button and the selection opens around the playhead.",
  },
  {
    title: "Drag until it feels right",
    body: "Two handles, 5 to 60 seconds. Playback loops the selection while you tune it, so you stop guessing where the punchline lands.",
  },
  {
    title: "Save a real Twitch clip",
    body: "Name it and save. Twitch renders an actual clip on your channel, give it a few seconds, and it comes back onto the timeline as a teal dot.",
  },
];

/** Which rail step each phase belongs to. */
const PHASE_STEP: Record<Phase, number> = {
  menu: 0,
  idle: 0,
  select: 1,
  loop: 1,
  name: 2,
  save: 2,
  hold: 2,
};

export function ClipCreationDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("select");

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const next = ORDER[(ORDER.indexOf(phase) + 1) % ORDER.length];
    const timer = setTimeout(() => setPhase(next), HOLD_MS[phase]);
    return () => clearTimeout(timer);
  }, [phase, inView, reducedMotion]);

  const hasSelection = phase !== "menu" && phase !== "idle";
  const named = phase === "name" || phase === "save" || phase === "hold";
  const saved = phase === "save" || phase === "hold";
  const activeStep = PHASE_STEP[phase];

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        className="grid items-center gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12"
      >
        <div
          className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5"
          aria-label="Animation: a clip selection is dragged out of the VOD timeline, named and saved as a Twitch clip"
        >
          {/* The store's toast, word for word. */}
          <AnimatePresence>
            {saved && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className="absolute -top-3 right-3 z-10 flex items-center gap-2 rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 shadow-lg"
              >
                <CircleCheck className="size-3.5 text-emerald-400" aria-hidden="true" />
                <p className="text-xs">Clip created successfully!</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Window edges and the dashboard's clip readout. */}
          <div className="flex h-4 items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>2:09:41</span>
            <AnimatePresence>
              {hasSelection && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="text-purple-300"
                >
                  Clip: 42s (5s - 60s)
                </motion.span>
              )}
            </AnimatePresence>
            <span>2:11:12</span>
          </div>

          <div className="relative mt-2">
            <div className="relative h-12 overflow-hidden rounded-md bg-white/[0.04]" aria-hidden="true">
              {/* Watched fill up to the raid */}
              <div className="absolute inset-y-0 left-0 w-[30%] bg-purple-500/25" />
              {/* A quiet spread of events inside the window */}
              <div className="absolute top-1/2 -mt-[5px] left-[30%] h-2.5 w-2.5 rounded-full bg-indigo-500 opacity-70" />
              <div className="absolute top-1/2 -mt-[5px] left-[43%] h-2.5 w-2.5 rounded-full bg-blue-500 opacity-40" />
              <div className="absolute top-1/2 -mt-[5px] left-[58%] h-2.5 w-2.5 rounded-full bg-emerald-500 opacity-40" />
              <div className="absolute top-1/2 -mt-[5px] left-[84%] h-2.5 w-2.5 rounded-full bg-blue-500 opacity-40" />

              {/* Selection overlay, the dashboard's purple block */}
              <motion.div
                initial={false}
                animate={{ opacity: hasSelection ? 1 : 0, scaleX: hasSelection ? 1 : 0.12 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="absolute inset-y-1 rounded border border-purple-500/50 bg-purple-500/30"
                style={{ left: SELECTION_LEFT, width: SELECTION_WIDTH }}
              />

              {/* Looping playhead: rides its own width across the selection */}
              <div
                className="pointer-events-none absolute inset-y-0"
                style={{ left: SELECTION_LEFT, width: SELECTION_WIDTH }}
              >
                {/* Full transform string, not the x shorthand: this is the one
                 * always-running tween, keep it off the main thread. */}
                <motion.div
                  className="h-full w-full border-l border-white"
                  initial={false}
                  animate={
                    phase === "loop"
                      ? { transform: ["translateX(0%)", "translateX(100%)"], opacity: 1 }
                      : { transform: "translateX(0%)", opacity: hasSelection ? 0.7 : 0 }
                  }
                  transition={
                    phase === "loop"
                      ? { duration: 1.4, repeat: Infinity, ease: "linear" }
                      : { duration: 0.3 }
                  }
                />
              </div>

              {/* Grip handles fade in once the selection has sprung */}
              {(["start", "end"] as const).map((edge) => (
                <motion.div
                  key={edge}
                  initial={false}
                  animate={{ opacity: hasSelection ? 1 : 0 }}
                  transition={{ duration: 0.2, delay: hasSelection ? 0.15 : 0 }}
                  className="absolute top-1/2 z-10 -mt-2.5 flex h-5 w-2.5 -translate-x-1/2 items-center justify-center rounded-sm bg-purple-500"
                  style={{ left: edge === "start" ? SELECTION_LEFT : "71.5%" }}
                >
                  <GripVertical className="size-2.5 text-white/80" aria-hidden="true" />
                </motion.div>
              ))}

              {/* The saved clip, back on the track as a teal dot */}
              <AnimatePresence>
                {saved && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 320, damping: 20 }}
                    className="absolute top-1/2 -mt-[5px] left-[48%] h-2.5 w-2.5 rounded-full bg-teal-500"
                  />
                )}
              </AnimatePresence>
            </div>

            {/* The context menu, as the dashboard labels it */}
            <AnimatePresence>
              {phase === "menu" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute left-[22%] top-1/2 z-10 origin-top-left rounded-md border border-white/15 bg-zinc-900 px-3 py-1.5 shadow-lg"
                  aria-hidden="true"
                >
                  <p className="flex items-center gap-1.5 text-xs">
                    <Scissors className="size-3 text-purple-300" aria-hidden="true" />
                    Create Clip Here
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Name it and save */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-white/10 bg-black/30 px-2.5 font-mono text-xs">
              <AnimatePresence mode="wait" initial={false}>
                {named ? (
                  <motion.span
                    key="title"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="truncate"
                  >
                    {demoClips[1].title}
                  </motion.span>
                ) : (
                  <motion.span
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-muted-foreground"
                  >
                    Name your clip
                  </motion.span>
                )}
              </AnimatePresence>
              <span
                className={cn(
                  "ml-px animate-pulse text-muted-foreground motion-reduce:animate-none",
                  phase === "name" ? "inline" : "hidden",
                )}
                aria-hidden="true"
              >
                _
              </span>
            </div>
            <motion.div
              initial={false}
              animate={{ scale: phase === "save" ? 0.94 : 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className={cn(
                "flex h-8 shrink-0 items-center rounded-md px-3 text-xs font-medium transition-colors duration-300",
                saved ? "bg-white text-zinc-900" : "bg-white/80 text-zinc-900",
              )}
              aria-hidden="true"
            >
              Save Clip
            </motion.div>
          </div>
        </div>

        {/* The three steps, with the loop pointing at the one it is on. Under
         * reduced motion the phase freezes on "select", so step 2 stays lit as
         * a static still; no render branch on useReducedMotion (hydration). */}
        <div className="grid gap-6">
          {STEPS.map((step, index) => {
            const isActive = activeStep === index;
            return (
              <div
                key={step.title}
                className={cn("transition-opacity duration-300", isActive ? "opacity-100" : "opacity-50")}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] transition-colors duration-300",
                      isActive
                        ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                        : "border-white/15 text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:pl-[34px]">{step.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </MotionConfig>
  );
}
