"use client";

import { MotionConfig, motion, useReducedMotion } from "motion/react";

/*
 * The door's sketch, acting out its own claim: the bars rise, the raid dot
 * lands on the spike, then an amber clip window closes around it — the VOD
 * page's handles, drawn where the graph's big moment is. One sequenced
 * whileInView pass; only the dot's ping loops, and not for reduced motion.
 * Bar heights are decorative, the dot is indigo like the timeline's raid
 * color (EVENT_TYPE_CONFIG).
 */

const SKETCH_BARS = ["24%", "30%", "28%", "42%", "92%", "74%", "58%", "50%", "44%", "38%"];

const VIEWPORT = { once: true, margin: "-64px" } as const;

export function DoorSpikeBeat() {
  const reducedMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto mb-8 max-w-md" aria-hidden="true">
        <div className="relative flex h-12 items-end gap-1 overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.04] px-2 pt-2">
          {SKETCH_BARS.map((height, i) => (
            <motion.div
              key={i}
              className="flex-1 origin-bottom rounded-t-sm bg-purple-500/40"
              style={{ height }}
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.05 }}
            />
          ))}

          {/* The raid dot, then its ping. */}
          <motion.div
            className="absolute top-[10%] left-[43%] h-2 w-2 rounded-full bg-indigo-500"
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={VIEWPORT}
            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.7 }}
          >
            {!reducedMotion && (
              <motion.span
                className="absolute inset-0 rounded-full bg-indigo-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.6, 0], scale: [1, 2.4] }}
                transition={{ duration: 1.6, ease: "easeOut", repeat: Infinity, repeatDelay: 0.8, delay: 1.4 }}
              />
            )}
          </motion.div>

          {/* The clip window: the VOD page's amber handles, closing around the spike. */}
          <motion.div
            className="absolute inset-y-1 left-[36%] w-[22%] rounded-sm bg-amber-400/10"
            initial={{ opacity: 0, scaleX: 0.6 }}
            whileInView={{ opacity: 1, scaleX: 1 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.45, ease: "easeOut", delay: 1.2 }}
          >
            <span className="absolute inset-y-0 left-0 w-[3px] rounded-full bg-amber-400/80" />
            <span className="absolute inset-y-0 right-0 w-[3px] rounded-full bg-amber-400/80" />
          </motion.div>
        </div>
        <div className="mt-2 flex justify-center">
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-px font-mono text-[10px] text-muted-foreground">
            the raid &middot; 2:10:00
          </span>
        </div>
      </div>
    </MotionConfig>
  );
}
