"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView, useReducedMotion } from "motion/react";
import { Download, Folder } from "lucide-react";
import { cn } from "@repo/ui";
import { demoClips } from "../home/demo-data";

/*
 * The clip-library collage with the page's own clip arriving: every few
 * seconds the clip cut in the section above drops onto the stack, the Raids
 * folder gives a small catch pulse, and the loop resets. No counters, so
 * nothing drifts across cycles. A monotonic tick re-drops the card each
 * cycle; the static collage is the first frame and the reduced-motion still.
 */

type Phase = "idle" | "drop";

const HOLD_MS: Record<Phase, number> = { idle: 2200, drop: 3200 };

export function ClipCollageLoop() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });
  const reducedMotion = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const phase: Phase = tick % 2 === 0 ? "idle" : "drop";
    const timer = setTimeout(() => setTick((current) => current + 1), HOLD_MS[phase]);
    return () => clearTimeout(timer);
  }, [tick, inView, reducedMotion]);

  const dropped = tick % 2 === 1;
  const cycle = Math.floor(tick / 2);

  return (
    <MotionConfig reducedMotion="user">
      <div ref={rootRef} className="relative mb-8 flex items-end justify-center gap-3" aria-hidden="true">
        <motion.div
          initial={false}
          animate={{ scale: dropped ? [1, 1.06, 1] : 1, rotate: -6 }}
          transition={{ duration: 0.5, delay: dropped ? 0.3 : 0 }}
        >
          <div className="flex w-32 items-center gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 sm:w-36">
            <Folder className="size-4 shrink-0 text-purple-300" />
            <span className="truncate font-mono text-[10px] text-muted-foreground">Raids</span>
          </div>
        </motion.div>
        <div className={cn("w-32 overflow-hidden rounded-lg border border-white/[0.08] sm:w-36", "rotate-2 -mt-2")}>
          <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-purple-500/30 to-black/60">
            <Download className="size-4 text-purple-300" />
          </div>
          <p className="truncate border-t border-white/[0.08] bg-black/30 px-2 py-1 font-mono text-[10px] text-muted-foreground">
            16:9
          </p>
        </div>
        <div className="rotate-6">
          <div className="w-14 overflow-hidden rounded-lg border border-white/[0.08] sm:w-16">
            <div className="flex aspect-[9/16] items-center justify-center bg-gradient-to-br from-teal-500/30 to-black/60">
              <Download className="size-4 text-purple-300" />
            </div>
            <p className="truncate border-t border-white/[0.08] bg-black/30 px-2 py-1 text-center font-mono text-[10px] text-muted-foreground">
              9:16
            </p>
          </div>
        </div>

        {/* The clip from the section above, landing on the stack */}
        {/* Static wrapper centers; the motion child keeps its transform to itself */}
        <div className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2">
          <AnimatePresence>
            {dropped && (
              <motion.div
                key={cycle}
                initial={{ opacity: 0, y: -32, rotate: -10 }}
                animate={{ opacity: 1, y: 0, rotate: -3 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-32 overflow-hidden rounded-lg border border-teal-400/30 shadow-lg sm:w-36"
              >
                <div className="aspect-video bg-gradient-to-br from-teal-500/40 to-black/70" />
                <p className="truncate border-t border-white/[0.08] bg-black/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  {demoClips[1].title}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
