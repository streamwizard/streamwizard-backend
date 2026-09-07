"use client";

import { motion } from "motion/react";

/*
 * The wires of the switcher flow diagram. Pure presentational: every component
 * takes primitives only, so the React Compiler can skip them during 60 fps
 * slider drags and only the once-a-second engine state moves them.
 *
 * All continuous motion is the CSS `animate-flow-dash` loop; the only
 * motion/react piece is the one-shot TickDot. Every SVG is aria-hidden: the
 * nodes carry the story, the wires illustrate it.
 */

export type EdgeTone = "emerald" | "amber" | "red" | "purple";

const STROKE: Record<EdgeTone, string> = {
  emerald: "stroke-emerald-400/80",
  amber: "stroke-amber-400/80",
  red: "stroke-red-400/80",
  purple: "stroke-purple-300/70",
};

const GLOW: Record<EdgeTone, string> = {
  emerald: "stroke-emerald-400/25",
  amber: "stroke-amber-400/25",
  red: "stroke-red-400/25",
  purple: "stroke-purple-300/25",
};

const DIM_STROKE = "stroke-white/10";

interface EdgeLineProps {
  vertical?: boolean;
  tone: EdgeTone;
  /** Dim and stop the dashes: the wire is there, nothing is on it. */
  cut?: boolean;
  /** What a cut wire looks like: red for a dead signal, plain dim otherwise. */
  cutClass?: string;
  /** Arbitrary [animation-duration:...] class, for the bitrate speed tiers. */
  durationClass?: string;
}

/** A straight percent-coordinate wire; needs no viewBox, dashes never scale. */
export function EdgeLine({
  vertical = false,
  tone,
  cut = false,
  cutClass = "stroke-red-400/25",
  durationClass = "",
}: EdgeLineProps) {
  return (
    <svg aria-hidden="true" className="block h-full w-full">
      <line
        x1={vertical ? "50%" : "0"}
        y1={vertical ? "0" : "50%"}
        x2={vertical ? "50%" : "100%"}
        y2={vertical ? "100%" : "50%"}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="6 8"
        className={`transition-[stroke] duration-500 ${
          cut ? cutClass : `${STROKE[tone]} animate-flow-dash motion-reduce:animate-none ${durationClass}`
        }`}
      />
    </svg>
  );
}

/*
 * Fan and merge geometry on lg is fully deterministic: the scenes column is
 * two 4.5rem (72px) cards with gap-4 (16px), 160px tall, so the SVGs are
 * fixed-size (56x160) and never scale. Node centers sit at y 36 / 124.
 * Mobile uses percent lines into a two-across scene strip instead.
 */
const FAN_PATHS = ["M 0 80 C 28 80 28 36 56 36", "M 0 80 C 28 80 28 124 56 124"] as const;

const MERGE_PATHS = ["M 0 36 C 28 36 28 80 56 80", "M 0 124 C 28 124 28 80 56 80"] as const;

/** Mobile scene-strip column centers, matching grid-cols-2. */
const STRIP_X = ["25%", "75%"] as const;

function branchClass(active: boolean, tone: EdgeTone): string {
  return `fill-none transition-[opacity,stroke] duration-500 ${active ? STROKE[tone] : `${DIM_STROKE} opacity-25`}`;
}

interface BranchesProps {
  /** Which scene the route runs through: 0 IRL, 1 Connection Lost. */
  activeIndex: number;
  tone: EdgeTone;
}

/** Switcher out to the two scenes. Exactly one branch carries the route. */
export function FanEdges({ activeIndex, tone }: BranchesProps) {
  return (
    <>
      <svg aria-hidden="true" viewBox="0 0 56 160" className="hidden h-40 w-14 lg:block">
        {FAN_PATHS.map((d, i) =>
          i === activeIndex ? (
            // Glow underlay first, then the dashed route on top. No SVG filters.
            <g key={d}>
              <path d={d} strokeWidth="4" className={`fill-none ${GLOW[tone]}`} />
              <path
                d={d}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="6 8"
                className={`${branchClass(true, tone)} animate-flow-dash motion-reduce:animate-none`}
              />
            </g>
          ) : (
            <path key={d} d={d} strokeWidth="1.5" strokeDasharray="6 8" className={branchClass(false, tone)} />
          ),
        )}
      </svg>
      <svg aria-hidden="true" className="block h-10 w-full lg:hidden">
        {STRIP_X.map((x, i) => (
          <g key={x}>
            {i === activeIndex ? (
              <line x1="50%" y1="0" x2={x} y2="100%" strokeWidth="4" className={`fill-none ${GLOW[tone]}`} />
            ) : null}
            <line
              x1="50%"
              y1="0"
              x2={x}
              y2="100%"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="6 8"
              className={`${branchClass(i === activeIndex, tone)} ${
                i === activeIndex ? "animate-flow-dash motion-reduce:animate-none" : ""
              }`}
            />
          </g>
        ))}
      </svg>
    </>
  );
}

/** The two scenes back into one wire toward Twitch. */
export function MergeEdges({ activeIndex, tone }: BranchesProps) {
  return (
    <>
      <svg aria-hidden="true" viewBox="0 0 56 160" className="hidden h-40 w-14 lg:block">
        {MERGE_PATHS.map((d, i) =>
          i === activeIndex ? (
            <g key={d}>
              <path d={d} strokeWidth="4" className={`fill-none ${GLOW[tone]}`} />
              <path
                d={d}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="6 8"
                className={`${branchClass(true, tone)} animate-flow-dash motion-reduce:animate-none`}
              />
            </g>
          ) : (
            <path key={d} d={d} strokeWidth="1.5" strokeDasharray="6 8" className={branchClass(false, tone)} />
          ),
        )}
      </svg>
      <svg aria-hidden="true" className="block h-10 w-full lg:hidden">
        {STRIP_X.map((x, i) => (
          <g key={x}>
            {i === activeIndex ? (
              <line x1={x} y1="0" x2="50%" y2="100%" strokeWidth="4" className={`fill-none ${GLOW[tone]}`} />
            ) : null}
            <line
              x1={x}
              y1="0"
              x2="50%"
              y2="100%"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="6 8"
              className={`${branchClass(i === activeIndex, tone)} ${
                i === activeIndex ? "animate-flow-dash motion-reduce:animate-none" : ""
              }`}
            />
          </g>
        ))}
      </svg>
    </>
  );
}

/**
 * One stats packet per engine tick, travelling ingest to switcher. The parent
 * keys it by the tick so each second fires one traversal. Hidden under reduced
 * motion explicitly: MotionConfig does not suppress left/top animations.
 */
export function TickDot({ vertical = false }: { vertical?: boolean }) {
  return (
    <motion.span
      aria-hidden="true"
      className={`absolute size-1.5 rounded-full bg-purple-300 shadow-[0_0_6px_rgba(158,122,255,0.9)] motion-reduce:hidden ${
        vertical ? "left-1/2 -translate-x-1/2" : "top-1/2 -translate-y-1/2"
      }`}
      initial={vertical ? { top: "0%", opacity: 0 } : { left: "0%", opacity: 0 }}
      animate={vertical ? { top: "100%", opacity: [0, 1, 1, 0] } : { left: "100%", opacity: [0, 1, 1, 0] }}
      transition={{ duration: 0.85, ease: "linear" }}
    />
  );
}
