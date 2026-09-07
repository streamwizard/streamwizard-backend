"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Plus } from "lucide-react";
import { Kbd, cn } from "@repo/ui";
import type { CanvasBackground } from "./canvas-preferences";
import { CANVAS_BACKGROUND_INK, type CanvasInk } from "./canvas-background";
import {
  EMPTY_CANVAS_TIP_INTERVAL_MS,
  nextTipIndex,
  resolveEmptyCanvasTips,
} from "./empty-canvas-tips";
import { MOD_KEY_TOKEN } from "./editor-shortcuts";
import { useModKeyLabel } from "./use-mod-key";

/*
 * What an empty canvas says instead of nothing: a way in to the widgets in the
 * middle, and one shortcut at a time in the bottom-left corner so the editor
 * teaches itself while there is nothing else to look at.
 *
 * Both sit over the canvas at screen size, not scene size, so they read the
 * same at any zoom. The canvas can be any colour the streamer picks, and the
 * app theme says nothing about that, so every colour here comes from the
 * canvas's own ink rather than the theme tokens.
 */

const TIPS = resolveEmptyCanvasTips();

/** Below this on-screen size the button would crowd the canvas; stay quiet. */
const MIN_WIDTH_PX = 200;
const MIN_HEIGHT_PX = 120;
/** The tip line needs room of its own in the corner, clear of the button. */
const TIPS_MIN_WIDTH_PX = 560;
const TIPS_MIN_HEIGHT_PX = 260;

const INK: Record<
  CanvasInk,
  { tip: string; tipHover: string; button: string; ring: string; kbd: string }
> = {
  light: {
    tip: "text-white/50",
    tipHover: "hover:text-white/80",
    button: "border-white/30 bg-white/10 text-white/90 hover:bg-white/20",
    ring: "focus-visible:ring-white/40",
    kbd: "bg-white/15 text-white/80",
  },
  dark: {
    tip: "text-black/45",
    tipHover: "hover:text-black/75",
    button: "border-black/25 bg-black/5 text-black/85 hover:bg-black/10",
    ring: "focus-visible:ring-black/30",
    kbd: "bg-black/10 text-black/70",
  },
};

interface EmptyCanvasHintProps {
  background: CanvasBackground;
  /** The canvas's on-screen size, so the hint can stand down when it wouldn't fit. */
  screenWidth: number;
  screenHeight: number;
  onAddWidget: () => void;
  onOpenShortcuts: () => void;
}

export function EmptyCanvasHint({
  background,
  screenWidth,
  screenHeight,
  onAddWidget,
  onOpenShortcuts,
}: EmptyCanvasHintProps) {
  const ink = INK[CANVAS_BACKGROUND_INK[background]];
  const modKey = useModKeyLabel();
  const tip = useRotatingTip();

  if (screenWidth < MIN_WIDTH_PX || screenHeight < MIN_HEIGHT_PX) return null;
  const showTip =
    tip !== null && screenWidth >= TIPS_MIN_WIDTH_PX && screenHeight >= TIPS_MIN_HEIGHT_PX;

  // The hint must never eat a click meant for the canvas, so only the controls
  // take the pointer, and they stop the mousedown that would otherwise start a
  // marquee or a pan underneath them.
  const stopCanvasGesture = (e: React.MouseEvent) => e.stopPropagation();

  const kbdClass = cn("h-6 min-w-6 px-1.5 text-sm", ink.kbd);
  const chips = (keys: string[]) => (
    <span className="inline-flex items-center gap-1">
      {keys.map((key) => (
        <Kbd key={key} className={kbdClass}>
          {key === MOD_KEY_TOKEN ? modKey : key}
        </Kbd>
      ))}
    </span>
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
      data-testid="empty-canvas-hint"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <button
          type="button"
          className={cn(
            "pointer-events-auto inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
            ink.button,
            ink.ring
          )}
          onMouseDown={stopCanvasGesture}
          onClick={onAddWidget}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add a widget
        </button>
      </div>

      {showTip && (
        <div className="absolute bottom-5 left-5 text-base">
          {/* Transform is dropped for reduced-motion users, leaving the fade. */}
          <MotionConfig reducedMotion="user">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tip.index}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {tip.opensShortcuts ? (
                  <button
                    type="button"
                    className={cn(
                      "pointer-events-auto inline-flex items-center gap-2 rounded px-1 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2",
                      ink.tip,
                      ink.tipHover,
                      ink.ring
                    )}
                    onMouseDown={stopCanvasGesture}
                    onClick={onOpenShortcuts}
                  >
                    {tip.text} {chips(tip.keys)}
                  </button>
                ) : (
                  <p className={cn("inline-flex items-center gap-2 px-1 py-0.5", ink.tip)}>
                    {tip.text} {chips(tip.keys)}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </MotionConfig>
        </div>
      )}
    </div>
  );
}

/**
 * Which tip is up right now. Starts somewhere random so a second visit leads
 * with a different one, and holds still while the tab is hidden: nobody is
 * reading, and a burst of catch-up renders on return helps no one.
 */
function useRotatingTip() {
  const [index, setIndex] = useState(() =>
    TIPS.length > 0 ? Math.floor(Math.random() * TIPS.length) : 0
  );

  useEffect(() => {
    if (TIPS.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setIndex((current) => nextTipIndex(current, TIPS.length));
    }, EMPTY_CANVAS_TIP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const tip = TIPS[index];
  return tip ? { index, ...tip } : null;
}
