"use client";

import type { ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  ALERTS,
  useCurrentDemoAlert,
  useDemoAlertAnim,
  useFireDemoAlert,
  useSetDemoAlertAnim,
  type AlertAnim,
} from "./overlay-demo-alert";
import { useDemoTracking } from "../analytics/use-demo-tracking";

/*
 * The alert box's per-event setup, wired to the demo above both ways:
 * whichever alert just fired up there is the event selected down here, with
 * its title template, its second line, its media, and its entrance animation;
 * and clicking an event chip fires that alert in the frame, while clicking an
 * animation replays it entering that way. Without a provider (or before the
 * first alert) it shows the first entry and the chips do nothing.
 */

const CHIP_BASE =
  "rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest transition-colors duration-300 ";
const CHIP_ON = "border-purple-500/40 bg-purple-500/10 text-purple-300";
const CHIP_OFF = "border-white/[0.08] bg-white/[0.03] text-muted-foreground";

/** A chip that does something: pressing it plays an alert in the frame above. */
function ActionChip({ children, active, onClick }: { children: ReactNode; active: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={!onClick}
      className={
        CHIP_BASE +
        (active ? CHIP_ON : CHIP_OFF + " hover:border-white/[0.18] hover:text-foreground") +
        " cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 disabled:cursor-default"
      }
    >
      {children}
    </button>
  );
}

const ANIMATIONS: { value: AlertAnim; label: string }[] = [
  { value: "fade", label: "Fade" },
  { value: "slide_up", label: "Slide up" },
  { value: "slide_down", label: "Slide down" },
  { value: "zoom", label: "Zoom" },
  { value: "bounce", label: "Bounce" },
];

/** A template with its {placeholders} drawn in the accent colour. */
function Template({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{[a-z]+\})/).map((part, i) =>
        part.startsWith("{") ? (
          <span key={i} className="text-purple-300">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function AlertBoxSketch() {
  const track = useDemoTracking("overlays");
  const current = useCurrentDemoAlert();
  const fire = useFireDemoAlert();
  const setAnim = useSetDemoAlertAnim();
  const anim = useDemoAlertAnim(current);
  const alert = ALERTS[current] ?? ALERTS[0];

  /* Pick the animation and replay the alert with it, so the choice is visible
     in the frame rather than only in the chip that lit up. */
  const pickAnim = setAnim && fire ? (value: AlertAnim) => {
    track("alert_anim_picked", { anim: value });
    setAnim(current, value);
    fire(current);
  } : null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
      <div
        role="group"
        aria-label="Alert events. Press one to play it in the preview above."
        className="flex flex-wrap content-start gap-1.5"
      >
        {ALERTS.map((a, i) => (
          <ActionChip
            key={a.kind}
            active={i === current}
            onClick={
              fire
                ? () => {
                    track("alert_fired", { kind: a.kind });
                    fire(i);
                  }
                : undefined
            }
          >
            {a.kind}
          </ActionChip>
        ))}
      </div>
      <div className="rounded-lg border border-white/[0.07] bg-black/50 p-3">
        <MotionConfig reducedMotion="user">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={alert.kind}
              role="img"
              aria-label={`Alert box settings for ${alert.kind}: media ${alert.media}, title template ${alert.template}, second line ${
                alert.messageTemplate ?? "empty, so the line is hidden"
              }, sound chime-soft.mp3 at 80%`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex items-center gap-3"
            >
              <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-linear-to-br from-purple-500/35 to-slate-900/60 px-1 text-center font-mono text-[9px] uppercase leading-tight tracking-widest text-purple-200">
                {alert.media}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Title</p>
                <p className="mt-0.5 truncate font-mono text-xs text-foreground">
                  <Template text={alert.template} />
                </p>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Second line
                </p>
                <p className="mt-0.5 truncate font-mono text-xs text-foreground">
                  {alert.messageTemplate ? (
                    <Template text={alert.messageTemplate} />
                  ) : (
                    <span className="text-muted-foreground">Empty · hidden</span>
                  )}
                </p>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Sound</p>
                <p className="mt-0.5 truncate font-mono text-xs text-foreground">chime-soft.mp3 · 80%</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </MotionConfig>
        <div
          role="group"
          aria-label={`In-animation for ${alert.kind}. Press one to replay the alert entering that way.`}
          className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-3"
        >
          <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">In</span>
          {ANIMATIONS.map((a) => (
            <ActionChip
              key={a.value}
              active={a.value === anim}
              onClick={pickAnim ? () => pickAnim(a.value) : undefined}
            >
              {a.label}
            </ActionChip>
          ))}
        </div>
      </div>
    </div>
  );
}
