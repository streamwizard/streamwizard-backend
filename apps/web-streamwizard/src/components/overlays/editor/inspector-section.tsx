"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { cn } from "@repo/ui";

/** Open and close at the same pace everywhere in the inspector. */
const REVEAL_TRANSITION = { duration: 0.22, ease: "easeOut" } as const;

// Collapsible inspector section: the editor shows the essentials expanded and
// tucks everything else behind these, so new users aren't hit with every
// option at once. State is per-mount on purpose - reselecting an item resets
// to the calm default.
//
// The body grows and shrinks rather than appearing at full height: the panel
// is a column of these, so a snap moves everything under it by the height of
// whatever just opened.
export function InspectorSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 hover:text-foreground transition-colors"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        {title}
      </button>
      <InspectorReveal show={open}>{children}</InspectorReveal>
    </div>
  );
}

/**
 * A block of fields that animates its own height in and out, for the ones a
 * mode or a toggle reveals. Height, opacity and the stack's own top margin all
 * move together, so nothing below it jumps by a row's worth of space before
 * the rest has finished.
 *
 * Overflow is clipped only while it moves: a settled block has focus rings to
 * show, and those sit outside its box.
 */
export function InspectorReveal({
  show,
  marginTop = 0,
  children,
}: {
  show: boolean;
  /** Matches the parent stack's gap when this block is not its first child. */
  marginTop?: number;
  children: ReactNode;
}) {
  /* A block that is already open on the first render never animates, and so
     never gets an onAnimationComplete to unclip it. */
  const [moving, setMoving] = useState(!show);

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          initial={{ height: 0, opacity: 0, marginTop: 0 }}
          animate={{ height: "auto", opacity: 1, marginTop }}
          exit={{ height: 0, opacity: 0, marginTop: 0 }}
          transition={REVEAL_TRANSITION}
          onAnimationStart={() => setMoving(true)}
          onAnimationComplete={() => setMoving(false)}
          className={cn(moving && "overflow-hidden")}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
