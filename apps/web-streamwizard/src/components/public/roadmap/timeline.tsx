"use client";

import { motion, useScroll, useSpring } from "motion/react";
import { useRef, type ReactNode } from "react";

/*
 * The roadmap spine. A hairline track runs the full height of the timeline and
 * a gradient fill draws itself down it as the page scrolls, via motion's
 * scroll primitives (no scroll listeners). Server-rendered lanes pass through
 * as children, same shape as Reveal.
 *
 * Reduced motion: the base track is always rendered, so the structure stands
 * without any animation; the scroll fill is decorative and removed with
 * motion-reduce:hidden. The timeline runs future-first, so both layers fade
 * out toward the top, where the plans have no dates yet.
 */

const SPINE_POSITION = "absolute top-0 bottom-0 left-3 w-px -translate-x-1/2 md:left-1/2";
const SPINE_FADE =
  "[mask-image:linear-gradient(to_bottom,transparent,black_10rem,black_calc(100%-8rem),transparent)]";

export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.55"],
  });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <div ref={ref} className={className ? `relative ${className}` : "relative"}>
      <div aria-hidden="true" className={`${SPINE_POSITION} ${SPINE_FADE} bg-white/[0.08]`} />
      <motion.div
        aria-hidden="true"
        style={{ scaleY }}
        className={`${SPINE_POSITION} ${SPINE_FADE} origin-top bg-gradient-to-b from-purple-300 via-[var(--color-three)] to-[var(--color-two)] motion-reduce:hidden`}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/*
 * The stretch of spine above the planned lane: a dashed flow arriving from
 * work that only exists in the issue tracker. Reuses the flow-dash keyframe;
 * the dashes stop under reduced motion but the segment stays visible.
 */
export function TimelineTail() {
  return (
    <div aria-hidden="true" className="relative h-20">
      <svg
        viewBox="0 0 16 80"
        fill="none"
        preserveAspectRatio="none"
        className="absolute top-0 left-3 h-full w-4 -translate-x-1/2 md:left-1/2"
      >
        <line
          x1="8"
          y1="0"
          x2="8"
          y2="80"
          stroke="var(--color-three)"
          strokeOpacity={0.4}
          strokeWidth={1.5}
          strokeDasharray="6 8"
          className="animate-flow-dash [animation-duration:1.4s] motion-reduce:animate-none"
        />
      </svg>
    </div>
  );
}
