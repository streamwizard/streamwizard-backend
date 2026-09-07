"use client";

import { MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";

/*
 * Scroll-reveal wrappers for the landing page. Server sections pass their
 * rendered children through, so the only client code on the page is the
 * motion itself.
 *
 * Reduced motion goes through MotionConfig reducedMotion="user" rather than a
 * useReducedMotion() branch: branching on the media query swaps the rendered
 * tree between server and client and breaks hydration for reduced-motion
 * visitors. MotionConfig keeps one tree and drops the transform animation for
 * them, leaving a plain opacity fade.
 */

type Direction = "up" | "left" | "right" | "scale";

const HIDDEN: Record<Direction, { opacity: number; x?: number; y?: number; scale?: number }> = {
  up: { opacity: 0, y: 16 },
  left: { opacity: 0, x: -16 },
  right: { opacity: 0, x: 16 },
  scale: { opacity: 0, scale: 0.98 },
};

const VISIBLE = { opacity: 1, x: 0, y: 0, scale: 1 };

interface RevealProps {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  className?: string;
}

export function Reveal({ children, direction = "up", delay = 0, className }: RevealProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={className}
        initial={HIDDEN[direction]}
        whileInView={VISIBLE}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: "easeOut", delay }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}

interface RevealGroupItem {
  node: ReactNode;
  /** Class on the staggered wrapper itself, e.g. grid col spans. */
  className?: string;
}

interface RevealGroupProps {
  className?: string;
  items: RevealGroupItem[];
}

export function RevealGroup({ className, items }: RevealGroupProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={className}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
      >
        {items.map((item, i) => (
          <motion.div
            key={i}
            className={item.className}
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
            }}
          >
            {item.node}
          </motion.div>
        ))}
      </motion.div>
    </MotionConfig>
  );
}
