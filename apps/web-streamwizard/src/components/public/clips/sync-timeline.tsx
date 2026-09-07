"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { cn } from "@repo/ui";

/*
 * Auto-playing vignette for the sync section, on loop: a live stream with
 * chat clipping away, the stream ends, a sync pass runs over skeleton
 * slots, and the new clips spring in. No controls and no real data; the
 * point is the order of events, not the clips. Chat rides a monotonic tick
 * so re-entering the live phase never needs a state reset (react-compiler:
 * no setState in effect bodies, only in timer callbacks).
 */

type Phase = "live" | "offline" | "sync" | "done";

const ORDER: Phase[] = ["live", "offline", "sync", "done"];
const HOLD_MS: Record<Phase, number> = { live: 5200, offline: 1600, sync: 2600, done: 4600 };
const CHAT_TICK_MS = 850;

const CHAT_MESSAGES = [
  "CLIP IT CLIP IT",
  "LMAOOO",
  "NO WAY",
  "W",
  "THE 1V5???",
  "clip that someone",
  "HE'S CRACKED",
  "chat did you see that",
];

const CLIPS = [
  { title: "the 1v5", tint: "from-cyan-500/40" },
  { title: "chat??", tint: "from-purple-500/40" },
  { title: "NO WAY", tint: "from-rose-500/40" },
  { title: "clutch", tint: "from-sky-500/40" },
  { title: "the fall", tint: "from-emerald-500/40" },
  { title: "??? lol", tint: "from-orange-500/40" },
];

const STATUS: Record<Phase, string> = {
  live: "Live. Chat is clipping.",
  offline: "Stream ended.",
  sync: "Syncing clips from the stream…",
  done: "6 new clips in the library.",
};

export function SyncTimeline() {
  const [phase, setPhase] = useState<Phase>("live");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const next = ORDER[(ORDER.indexOf(phase) + 1) % ORDER.length];
    const timer = setTimeout(() => setPhase(next), HOLD_MS[phase]);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "live") return;
    const interval = setInterval(() => setTick((t) => t + 1), CHAT_TICK_MS);
    return () => clearInterval(interval);
  }, [phase]);

  const live = phase === "live";
  const clipsIn = phase === "done";

  const chat = live
    ? [tick - 2, tick - 1, tick]
        .filter((n) => n >= 0)
        .map((n) => ({ id: n, text: CHAT_MESSAGES[n % CHAT_MESSAGES.length] }))
    : [];
  return (
    <MotionConfig reducedMotion="user">
      <div
        className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"
        aria-label="Animation: chat clips a live stream, the stream ends and StreamWizard syncs the new clips by itself"
      >
        {/* The live badge is the trigger for everything below. */}
        <div className="flex items-center justify-end">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest transition-colors duration-500",
              live
                ? "border-red-500/40 bg-red-500/10 text-red-300"
                : "border-white/[0.08] bg-white/[0.03] text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full transition-colors duration-500",
                live ? "animate-pulse bg-red-400" : "bg-zinc-500",
              )}
            />
            {live ? "Live" : "Offline"}
          </span>
        </div>

        {/* Stream preview: glowing while live, dark once it ends. Chat
            bubbles and the clip toast float over it. */}
        <div className="relative mt-4 overflow-hidden rounded-xl border border-white/[0.08]">
          <div
            className={cn(
              "aspect-[16/7] transition-colors duration-700",
              live ? "bg-gradient-to-br from-purple-500/25 via-fuchsia-500/10 to-black/60" : "bg-black/50",
            )}
          />
          <motion.div
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-purple-400/15 to-transparent"
            animate={live ? { opacity: [0.3, 0.8, 0.3] } : { opacity: 0 }}
            transition={live ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.5 }}
            aria-hidden="true"
          />
          <AnimatePresence>
            {!live && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground"
              >
                Offline
              </motion.p>
            )}
          </AnimatePresence>

          <div className="absolute bottom-2 left-2 flex flex-col items-start gap-1">
            <AnimatePresence initial={false} mode="popLayout">
              {chat.map(({ id, text }) => (
                <motion.span
                  key={id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-md bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white/80"
                >
                  {text}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>

        </div>

        <div className="mt-4">
          <div className="flex h-5 items-center gap-2" aria-live="polite">
            <RefreshCw
              className={cn(
                "size-3.5 text-purple-400 transition-opacity duration-300",
                phase === "sync" ? "animate-spin opacity-100" : "opacity-0",
              )}
              aria-hidden="true"
            />
            <motion.p
              key={phase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn("text-sm", clipsIn ? "text-purple-200" : "text-muted-foreground")}
            >
              {STATUS[phase]}
            </motion.p>
            <AnimatePresence>
              {clipsIn && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 18 }}
                  className="rounded-full border border-purple-400/30 bg-purple-400/[0.08] px-2 py-px font-mono text-[10px] text-purple-300"
                >
                  +6
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
            <motion.div
              className="h-full rounded-full bg-purple-400/70"
              initial={false}
              animate={{ width: phase === "sync" || clipsIn ? "100%" : "0%" }}
              transition={
                phase === "sync"
                  ? { duration: HOLD_MS.sync / 1000, ease: "easeInOut" }
                  : { duration: 0.3 }
              }
            />
          </div>
        </div>

        {/* Library slots: skeletons that shimmer during the sync pass,
            then the clips spring in over them. */}
        <motion.div
          className="mt-4 grid grid-cols-3 gap-2.5"
          initial={false}
          animate={clipsIn ? "visible" : "hidden"}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        >
          {CLIPS.map(({ title, tint }, i) => (
            <div key={title} className="relative overflow-hidden rounded-lg border border-white/[0.08]">
              <motion.div
                animate={phase === "sync" ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
                transition={
                  phase === "sync"
                    ? { duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.12 }
                    : { duration: 0.3 }
                }
                aria-hidden="true"
              >
                <div className="aspect-video bg-white/[0.03]" />
                <div className="border-t border-white/[0.08] bg-black/30 px-2 py-1">
                  <div className="h-3.5 w-10 rounded bg-white/[0.06]" />
                </div>
              </motion.div>
              <motion.div
                variants={{
                  hidden: { opacity: 0, scale: 0.85, y: 14 },
                  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 20 } },
                }}
                className="absolute inset-0"
              >
                <div className={cn("aspect-video bg-gradient-to-br to-black/60", tint)} />
                <p className="truncate border-t border-white/[0.08] bg-black/30 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  {title}
                </p>
              </motion.div>
            </div>
          ))}
        </motion.div>
      </div>
    </MotionConfig>
  );
}
