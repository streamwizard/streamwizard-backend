"use client";

import { MotionConfig, motion } from "motion/react";

/*
 * A GPS walk trace for the origin story: the route draws itself in when
 * scrolled into view, a dashed flow keeps moving along it, and a packet dot
 * walks the path on a CSS offset-path loop.
 *
 * Reduced motion: the faint base track is always rendered, so the route is
 * visible without any animation. The draw layer and the travelling dot are
 * removed with motion-reduce:hidden, the dash loop stops with
 * motion-reduce:animate-none. CSS-only gates, one tree, no hydration branch.
 */

const TRACE_D =
  "M 28 262 C 74 244 62 196 100 176 C 146 152 154 200 200 180 C 254 156 230 100 272 80 C 306 64 336 88 380 44";

/** Real milestones, hand-placed against TRACE_D's viewBox (408x300). */
const WAYPOINTS = [
  { left: "16%", top: "90%", label: "Minecraft Integration", dotLeft: "6.9%", dotTop: "87.3%" },
  { left: "24.5%", top: "44%", label: "irl overlay", dotLeft: "24.5%", dotTop: "58.7%" },
  { left: "49%", top: "66%", label: "2024 clip folders", dotLeft: "49%", dotTop: "60%" },
  { left: "91%", top: "8%", label: "cloud obs", dotLeft: "93.1%", dotTop: "14.7%" },
] as const;

export function OriginTrace({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        {/* Faint street grid behind the trace, so it reads as a map. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative aspect-[408/300]">
          <MotionConfig reducedMotion="user">
            <svg
              viewBox="0 0 408 300"
              fill="none"
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Base track: always visible, carries the route under reduced motion. */}
              <path
                d={TRACE_D}
                stroke="currentColor"
                strokeOpacity={0.12}
                strokeWidth={3}
                strokeLinecap="round"
              />
              {/* The walk, drawing itself in. */}
              <motion.path
                d={TRACE_D}
                stroke="var(--color-three)"
                strokeWidth={3}
                strokeLinecap="round"
                className="motion-reduce:hidden"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 1.6, ease: "easeInOut" }}
              />
              {/* Slow dashed flow on top, the signal still moving. */}
              <path
                d={TRACE_D}
                stroke="var(--color-three)"
                strokeOpacity={0.5}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray="6 8"
                className="animate-flow-dash [animation-duration:1.4s] motion-reduce:animate-none"
              />
              {/* Packet dot walking the route. SMIL animateMotion works in
                  viewBox units, so it stays on the path at any rendered size,
                  which CSS offset-path (raw px space) would not. */}
              <circle
                r={4}
                fill="var(--color-three)"
                className="[filter:drop-shadow(0_0_6px_var(--color-three))] motion-reduce:hidden"
              >
                <animateMotion dur="9s" repeatCount="indefinite" path={TRACE_D} />
              </circle>
            </svg>
          </MotionConfig>

          {WAYPOINTS.map((point) => (
            <div key={point.label}>
              <div
                className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-three)] bg-background"
                style={{ left: point.dotLeft, top: point.dotTop }}
              />
              <span
                className="absolute -translate-x-1/2 translate-y-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
                style={{ left: point.left, top: point.top }}
              >
                {point.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
