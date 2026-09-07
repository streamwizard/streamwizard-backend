"use client";

import { useEffect, useRef, useState } from "react";
import { useDemoTracking } from "../analytics/use-demo-tracking";
import { AnimatePresence, MotionConfig, motion, useInView } from "motion/react";
import { cn } from "@repo/ui";
import { OverlayChatWidget } from "./overlay-chat-widget";
import { CLOCK_START, ClockWidget, StartingSoonOverlay } from "./away-overlays";
import { DemoAlertBox, useDemoAlertFrameRef, useDemoAlerts } from "./overlay-demo-alert";

/*
 * What a viewer sees on a stream with a StreamWizard overlay on it, in the two
 * scenes every channel has: the starting screen (a countdown, a line of text,
 * clips rotating from the channel) and the live scene (camera, chat, a text
 * bar with the commands, the time). The alert box fires in both.
 *
 * Drawn to the real widgets' defaults (Inter, #b9b9c6 labels, #9e7aff accent)
 * but wired to nothing. Every number starts from a fixed value so server and
 * client paint the same first frame; the ticking only begins in effects.
 */

type Scene = "starting" | "live";

function SceneToggle({ scene, onChange }: { scene: Scene; onChange: (s: Scene) => void }) {
  const options: { value: Scene; label: string }[] = [
    { value: "starting", label: "Starting soon" },
    { value: "live", label: "Live" },
  ];
  return (
    <div
      role="group"
      aria-label="Scene"
      className="flex rounded-md border border-white/[0.08] bg-white/[0.03] p-0.5 font-mono text-[10px] uppercase tracking-widest"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={scene === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded px-2 py-1 transition-colors",
            scene === opt.value ? "bg-purple-500/15 text-purple-300" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const COMMANDS = ["!discord", "!socials", "!clip"];

/** Live scene: gameplay, the camera, chat, and a text widget with the commands along the bottom. */
function LiveScene() {
  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#0f1f24_0%,#1a2a3d_50%,#0d1117_100%)]" />
      <motion.div
        className="absolute -inset-x-[10%] inset-y-0 bg-[radial-gradient(circle_at_65%_35%,rgba(45,212,191,0.22),transparent_50%),radial-gradient(circle_at_20%_80%,rgba(251,191,36,0.14),transparent_50%)]"
        animate={{ x: ["0%", "-5%", "0%"] }}
        transition={{ duration: 14, ease: "easeInOut", repeat: Infinity }}
      />
      {/* A floor grid in perspective and a faint HUD, enough to read as a game and nothing more. */}
      <div className="absolute inset-x-0 bottom-0 h-[48%] overflow-hidden [perspective:320px]">
        <div className="absolute -inset-x-1/2 bottom-0 top-0 origin-top bg-[linear-gradient(rgba(45,212,191,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,191,0.18)_1px,transparent_1px)] bg-[size:6%_22%] [transform:rotateX(58deg)]" />
        <div className="absolute inset-x-0 top-0 h-1/3 bg-[linear-gradient(to_bottom,#13232b,transparent)]" />
      </div>
      <div className="absolute inset-x-0 top-[52%] h-px bg-teal-200/[0.12]" />
      <div className="absolute right-[3%] top-[20%] aspect-square w-[11%] rounded-full border border-white/[0.14] bg-black/25">
        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
        <span className="absolute left-[30%] top-[38%] h-0.5 w-0.5 rounded-full bg-amber-300/80" />
        <span className="absolute left-[64%] top-[62%] h-0.5 w-0.5 rounded-full bg-amber-300/80" />
        <span className="absolute left-[58%] top-[28%] h-0.5 w-0.5 rounded-full bg-red-400/80" />
      </div>
      <div className="absolute bottom-[8%] left-[34%] right-[34%] h-[2.5%] overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full w-[68%] rounded-full bg-teal-300/50" />
      </div>

      {/* Chat widget, stacked above the camera on the left */}
      <div className="absolute bottom-[35%] left-[3%] w-[34%] @md:w-[30%]">
        <OverlayChatWidget />
      </div>

      {/* The camera, bottom left: scene furniture, not a widget */}
      <div className="absolute bottom-[6%] left-[3%] aspect-video w-[26%] overflow-hidden rounded-md border border-white/[0.12] bg-[linear-gradient(150deg,#3b2a4a,#1a1420)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,205,170,0.35),transparent_45%)]" />
        <div className="absolute bottom-[12%] left-1/2 h-[40%] w-[44%] -translate-x-1/2 rounded-t-full bg-black/35" />
      </div>

      {/* Text widget, bottom right */}
      <div className="absolute bottom-[7%] right-[3%] flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-0.5 @md:gap-3 @md:px-3 @md:py-1">
        {COMMANDS.map((c, i) => (
          <span
            key={c}
            className={cn(
              "font-mono text-[7px] font-semibold @md:text-[10px] @xl:text-xs",
              i === 2 ? "text-[#9e7aff]" : "text-white",
            )}
          >
            {c}
          </span>
        ))}
      </div>
    </>
  );
}

export function StreamOverlayDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });

  const [scene, setScene] = useState<Scene>("starting");
  const [tick, setTick] = useState(0);
  const track = useDemoTracking("overlays");
  const alertPlay = useDemoAlerts(inView);
  const frameRef = useDemoAlertFrameRef();

  // One tick a second while the demo is on screen; drives the clock and the countdown.
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <div ref={rootRef} className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2 shadow-[0_16px_48px_-16px_rgba(158,122,255,0.25)] sm:p-3">
        {/* Header row: what this frame is, and the one control visitors get. */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 sm:mb-3">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" />
            Browser source · 1920×1080
          </p>
          <SceneToggle
            scene={scene}
            onChange={(next) => {
              track(`scene_${next}`);
              setScene(next);
            }}
          />
        </div>

        {/* The program output. Container queries size the overlay text to the
            frame, not the viewport, so it reads the same in a 340px card and a
            900px one. */}
        <MotionConfig reducedMotion="user">
          <div
            role="img"
            aria-label={
              scene === "starting"
                ? "A starting soon screen with StreamWizard overlays on it: a countdown, a line of text, clips from the channel rotating on the right, the time in a corner, and alerts popping in"
                : "A live stream with StreamWizard overlays on it: the camera in a corner, chat with badges and emotes down the left, a bar with the chat commands, the time in a corner, and alerts popping in"
            }
            ref={frameRef}
            className="@container relative aspect-video scroll-mt-24 select-none overflow-hidden rounded-lg bg-black"
          >
            <div aria-hidden="true" className="absolute inset-0">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={scene}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: "easeInOut" }}
                  className="absolute inset-0"
                >
                  {scene === "starting" ? <StartingSoonOverlay tick={tick} /> : <LiveScene />}
                </motion.div>
              </AnimatePresence>

              {/* Widgets that sit in both scenes, above the crossfade */}
              <ClockWidget sec={CLOCK_START + tick} />

              {/* Alert box, upper middle, below the clock's row; the starting
                  screen keeps its own content under this band. */}
              <div className="absolute inset-x-[8%] top-[16%] flex justify-center @md:inset-x-[12%]">
                <DemoAlertBox play={alertPlay} />
              </div>
            </div>
          </div>
        </MotionConfig>
      </div>
    </div>
  );
}
