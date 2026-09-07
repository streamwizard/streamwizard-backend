"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Lock } from "lucide-react";

/*
 * A mock of the private channel the Discord bot opens when someone hits
 * Create Ticket, typing its rows in one at a time once scrolled into view.
 * The strings mirror what the bot actually posts (subject, category, the
 * linked-account line, the staff button row), but the ticket itself is
 * curated and the caption under the card says so.
 *
 * useReducedMotion() here only decides whether rows appear staggered or all
 * at once, and only after inView flips, which happens post-hydration. The
 * initial render is zero rows on both server and client, so there is no
 * hydration risk. Same justification as build-log.tsx.
 */

const ROW_INTERVAL_MS = 550;

const ROWS = [
  {
    id: "created",
    node: (
      <p className="text-xs text-muted-foreground sm:text-sm">
        <span aria-hidden="true">🎫</span> Ticket created by{" "}
        <span className="rounded bg-purple-400/15 px-1 py-0.5 text-purple-300">@you</span>
      </p>
    ),
  },
  {
    id: "embed",
    node: (
      <div className="rounded-md border-l-2 border-purple-400/70 bg-white/[0.04] p-3">
        <p className="text-sm font-semibold">Overlay stuck on the BRB scene</p>
        <dl className="mt-2 space-y-1.5 text-xs sm:text-sm">
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">Category</dt>
            <dd>🐛 Bug</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">StreamWizard account</dt>
            <dd>✅ Linked — WizardFan (wizard@…)</dd>
          </div>
        </dl>
      </div>
    ),
  },
  {
    id: "user-message",
    node: (
      <p className="text-xs sm:text-sm">
        <span className="font-semibold">you</span>{" "}
        <span className="text-muted-foreground">your app sucks</span>
      </p>
    ),
  },
  {
    id: "claimed",
    node: (
      <p className="text-xs sm:text-sm">
        <span className="font-semibold text-purple-300">staff</span>{" "}
        <span className="text-muted-foreground">Claimed. Looking at it now.</span>
      </p>
    ),
  },
  {
    id: "staff-reply",
    node: (
      <p className="text-xs sm:text-sm">
        <span className="font-semibold text-purple-300">staff</span>{" "}
        <span className="text-muted-foreground">thanks for the detailed repro steps</span>
      </p>
    ),
  },
  {
    id: "buttons",
    node: (
      <div className="flex flex-wrap gap-2" aria-hidden="true">
        {["Claim", "Close Ticket 🔒", "Move to GitHub 🐙"].map((label) => (
          <span
            key={label}
            className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs text-muted-foreground"
          >
            {label}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: "closed",
    node: (
      <p className="text-xs text-muted-foreground sm:text-sm">
        <span aria-hidden="true">🔒</span> Ticket closed by staff. Not much to go on.
      </p>
    ),
  },
] as const;

export function TicketFlow({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reducedMotion = useReducedMotion();
  const [visibleCount, setVisibleCount] = useState(0);

  const shownCount = reducedMotion && inView ? ROWS.length : visibleCount;

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const id = setInterval(() => {
      setVisibleCount((count) => {
        if (count >= ROWS.length) {
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
          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="font-mono text-xs text-muted-foreground">ticket-0042</span>
          <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
            visible to you and staff
          </span>
        </div>
        <div className="min-h-[375px] space-y-3 p-4">
          {ROWS.slice(0, shownCount).map((row) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 40 }}
            >
              {row.node}
            </motion.div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-xs text-muted-foreground">
        Illustrative. Your ticket number will be lower than you expect.
      </p>
    </div>
  );
}
