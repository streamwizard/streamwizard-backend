"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView, useReducedMotion } from "motion/react";
import { demoEventStripTypes } from "../home/demo-data";

/*
 * The scene-switch mock with a pulse: the chip walks through one IRL
 * stream's three switches (a deck tap, the auto switcher catching a dropped
 * signal, the auto switcher bringing IRL back) and each flip lands a sky dot
 * on the strip. A monotonic tick carries the loop so every new cycle
 * re-drops the dots (sync-timeline's trick). First frame is the full strip,
 * which is also the reduced-motion still.
 */

const FLIPS = [
  { scene: "Gameplay → IRL", source: "deck" },
  { scene: "IRL → BRB", source: "auto switcher" },
  { scene: "BRB → IRL", source: "auto switcher" },
];

const HOLD_MS = 2600;

const OFFSETS =
  demoEventStripTypes.find((type) => type.label === "Scene switches")?.offsets ?? [];
const DURATION = 15120;

export function SceneSwitchLoop() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });
  const reducedMotion = useReducedMotion();
  /* Starts at the last flip so the first frame shows all three dots. */
  const [tick, setTick] = useState(FLIPS.length - 1);

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const timer = setTimeout(() => setTick((current) => current + 1), HOLD_MS);
    return () => clearTimeout(timer);
  }, [tick, inView, reducedMotion]);

  const step = tick % FLIPS.length;
  const cycle = Math.floor(tick / FLIPS.length);
  const flip = FLIPS[step];

  return (
    <MotionConfig reducedMotion="user">
      <div ref={rootRef} className="mx-auto mb-8 max-w-md" aria-hidden="true">
        <div className="relative h-10 overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.04]">
          <AnimatePresence initial={false}>
            {OFFSETS.slice(0, step + 1).map((offset, index) => (
              <motion.div
                key={`${cycle}-${offset}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 340,
                  damping: 22,
                  delay: index === step ? 0.15 : 0,
                }}
                className="absolute top-1/2 -mt-1 h-2 w-2 rounded-full bg-sky-500"
                style={{ left: `${(offset / DURATION) * 100}%` }}
              />
            ))}
          </AnimatePresence>
        </div>
        <div className="mt-2 flex h-5 justify-center overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`${cycle}-${step}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-px font-mono text-[10px] text-muted-foreground"
            >
              {flip.scene} · {flip.source}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
