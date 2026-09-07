"use client";

import { Check } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import type { TimelineStatus } from "@/app/(public)/roadmap/roadmap-data";

/*
 * The dots on the roadmap spine. Each status gets its own treatment: shipped
 * settles into the purple-ringed check the product pages use, beta pulses,
 * later is an empty outline waiting its turn.
 *
 * The background disc masks the spine so the line reads as passing behind the
 * node. Entrances go through MotionConfig reducedMotion="user" (opacity-only
 * fade for reduced-motion visitors, one tree, no hydration branch). The
 * infinite pulse and glow loops animate opacity, which MotionConfig would keep
 * running, so those layers are CSS-gated with motion-reduce:hidden and a
 * static dot always remains underneath.
 */

export function TimelineNode({ status, accent }: { status: TimelineStatus; accent?: "amber" }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.span
        className="relative flex h-6 w-6 items-center justify-center rounded-full bg-background"
        initial={{ scale: 0.5, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {status === "shipped" && (
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full border ${
              accent === "amber"
                ? "border-amber-500/30 bg-amber-500/15"
                : "border-purple-500/30 bg-purple-500/15"
            }`}
          >
            <Check
              className={`h-3 w-3 ${accent === "amber" ? "text-amber-400" : "text-purple-400"}`}
              aria-hidden="true"
            />
          </span>
        )}

        {status === "beta" && (
          <span className="relative h-3 w-3">
            <span className="absolute inset-0 rounded-full bg-purple-300" />
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-purple-300/60 motion-reduce:hidden"
              animate={{ scale: [1, 2.4], opacity: [0.7, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />
          </span>
        )}

        {status === "later" && (
          <span className="h-3 w-3 rounded-full border border-white/[0.15] bg-transparent" />
        )}
      </motion.span>
    </MotionConfig>
  );
}
