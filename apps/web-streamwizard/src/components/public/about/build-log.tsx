"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

/*
 * A terminal card styled like `git log --oneline`, typing its rows in one at a
 * time once scrolled into view. The entries are curated and illustrative, and
 * the caption under the card says so; nothing here should read as a claim.
 *
 * useReducedMotion() here only decides whether rows appear staggered or all
 * at once, and only after inView flips, which happens post-hydration. The
 * initial render is zero rows on both server and client, so there is no
 * hydration risk. Same justification as handoff-arrow.tsx.
 */

const ENTRIES = [
  { hash: "a3f21c9", message: "fix: deck reconnects after the tunnel" },
  { hash: "9be04d2", message: "feat: clip folders that sort themselves" },
  { hash: "4cc1e77", message: "fix: auto switcher stops flapping between scenes" },
  { hash: "d81f0ab", message: "feat: cut clips straight from the VOD" },
  { hash: "27e93c4", message: "fix: chat widget no longer eats emotes" },
  { hash: "f60b21d", message: "fix: the bug a streamer found before the tests did" },
] as const;

const ROW_INTERVAL_MS = 320;

export function BuildLog({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reducedMotion = useReducedMotion();
  const [visibleCount, setVisibleCount] = useState(0);

  const shownCount = reducedMotion && inView ? ENTRIES.length : visibleCount;

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const id = setInterval(() => {
      setVisibleCount((count) => {
        if (count >= ENTRIES.length) {
          clearInterval(id);
          return count;
        }
        return count + 1;
      });
    }, ROW_INTERVAL_MS);
    return () => clearInterval(id);
  }, [inView, reducedMotion]);

  return (
    <div ref={ref} className={className}>
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
          <span className="ml-2 font-mono text-xs text-muted-foreground">git log --oneline</span>
        </div>
        <div className="min-h-[220px] p-4 font-mono text-xs sm:text-sm">
          {ENTRIES.slice(0, shownCount).map((entry) => (
            <motion.div
              key={entry.hash}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 40 }}
              className="flex gap-3 py-1"
            >
              <span className="shrink-0 text-purple-300">{entry.hash}</span>
              <span className="text-muted-foreground">{entry.message}</span>
            </motion.div>
          ))}
          <div className="flex gap-3 py-1" aria-hidden>
            <span className="animate-pulse text-muted-foreground motion-reduce:animate-none">
              _
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-xs text-muted-foreground">
        Illustrative. The real log is longer and less flattering.
      </p>
    </div>
  );
}
