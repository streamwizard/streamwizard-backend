"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";
import { ClipsRotatorMini } from "./overlay-widget-demos";

/*
 * The three screens a channel runs when nobody is talking over them: starting
 * soon, BRB, and the one the auto switcher cuts to when the feed drops. Each
 * is the same widget set arranged differently, which is the point: one browser
 * source, your layout.
 *
 * Drawn to the real widgets' defaults (Inter, #b9b9c6 labels, #9e7aff accent)
 * but wired to nothing. Shared by the overlay section's demo frame and by the
 * scene previews inside the OBS window, so the two cannot drift apart.
 * Container queries size the text to the frame rather than the viewport, so it
 * reads the same in a 340px scene preview and in a 900px demo. Every number
 * starts from a fixed value so server and client paint the same first frame;
 * ticking only begins in effects.
 */

// Starts at 9:58 so the countdown reads as "almost live", not as a timer nobody set.
export const COUNTDOWN_START = 9 * 60 + 58;
export const CLOCK_START = 19 * 3600 + 42 * 60 + 5;
// The BRB screen runs a shorter one: a break, not a pre-show.
const BRB_COUNTDOWN_START = 4 * 60 + 31;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function clockLabel(sec: number) {
  return `${pad(Math.floor(sec / 3600) % 24)}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;
}

/** mm:ss, the format every one of these screens counts in. */
function mmss(sec: number) {
  return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
}

function countdownLabel(start: number, tick: number) {
  return mmss(Math.max(0, start - tick));
}

/**
 * `clipsVideo` plays the real montage in the rotator instead of the drawn
 * stand-in, and `chat` is the chat widget to drop into the layout. Only the OBS
 * window passes either: it is the surface with a demo store behind it, so its
 * chat is the live one, while the marketing frames stay drawings that cost
 * nothing to load.
 */
export interface AwayOverlayProps {
  tick: number;
  clipsVideo?: boolean;
  chat?: ReactNode;
}

/** One tick a second, but only while the frame is on screen. */
export function useOverlayTick(active: boolean) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  return tick;
}

/** The time widget, top left. */
export function ClockWidget({ sec }: { sec: number }) {
  return (
    <div className="absolute top-[5%] left-[3%] text-[10px] font-semibold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] @md:text-sm @xl:text-base">
      {clockLabel(sec)}
    </div>
  );
}

/** The caption under a clips widget, at the size the frame calls for. */
function ClipsCaption({ align = "right", children }: { align?: "right" | "center"; children: ReactNode }) {
  return (
    <p
      className={`mt-1 text-[6px] font-semibold tracking-[0.2em] text-[#b9b9c6] uppercase @md:text-[7px] @3xl:mt-1.5 @3xl:text-[10px] ${
        align === "center" ? "text-center" : "text-right"
      }`}
    >
      {children}
    </p>
  );
}

/**
 * Starting soon: text and countdown left, clips right.
 *
 * `clipsVideo` plays the real montage in the rotator instead of the drawn
 * stand-in. Only the OBS window asks for it, so the marketing frames stay
 * drawings and cost nothing to load.
 */
export function StartingSoonOverlay({ tick, clipsVideo = false, chat }: AwayOverlayProps) {
  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#1a1530_0%,#2b1d4a_55%,#0f1018_100%)]" />
      <motion.div
        className="absolute inset-y-0 -inset-x-[10%] bg-[radial-gradient(circle_at_25%_60%,rgba(158,122,255,0.4),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(96,165,250,0.18),transparent_50%)]"
        animate={{ x: ["0%", "5%", "0%"] }}
        transition={{ duration: 16, ease: "easeInOut", repeat: Infinity }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:8%_14%]" />

      {/* Text widget + countdown, left half */}
      <div className="absolute top-[32%] bottom-[10%] left-[5%] flex w-[44%] flex-col justify-center">
        <p className="hidden text-[7px] font-semibold tracking-[0.22em] text-[#b9b9c6] uppercase @lg:block @lg:text-[9px] @3xl:text-xs">
          Just chatting · every Tuesday
        </p>
        <p className="mt-0.5 text-[16px] leading-none font-extrabold tracking-tight whitespace-nowrap text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] @md:mt-1 @md:text-2xl @2xl:text-4xl @3xl:text-5xl">
          Starting soon
        </p>
        <p className="mt-1 text-[7px] text-[#d4d4d8] @md:mt-2 @md:text-[10px] @3xl:text-sm">
          Grab a drink. Chat is open.
        </p>
        <div className="mt-2 flex items-baseline gap-1 @md:mt-4">
          <span className="text-[18px] leading-none font-bold tabular-nums text-[#9e7aff] drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] @md:text-3xl @2xl:text-5xl @3xl:text-6xl">
            {countdownLabel(COUNTDOWN_START, tick)}
          </span>
        </div>
      </div>

      {/* Clips widget, right column. A clips box is as tall as it is wide in
          percent (16:9 inside 16:9), so sharing the column with chat means
          giving up height: it sits higher and narrower, ending around 70%,
          which leaves the bottom third for the lines. Without chat it keeps the
          roomier placement the overlay section uses. */}
      <div
        className={
          chat ? "absolute top-[25%] right-[5%] w-[38%]" : "absolute top-[36%] right-[5%] w-[42%] @md:top-[33%]"
        }
      >
        <ClipsRotatorMini video={clipsVideo} />
        <ClipsCaption>Clips from last stream</ClipsCaption>
      </div>

      {/* Chat widget, under the clips, grown up from the bottom edge */}
      {chat ? <div className="absolute right-[5%] bottom-[6%] w-[38%]">{chat}</div> : null}
    </>
  );
}

/** BRB: the starting screen's two columns, swapped. Clips lead, text follows. */
export function BrbOverlay({ tick, clipsVideo = false, chat }: AwayOverlayProps) {
  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(200deg,#101a2b_0%,#1d2440_55%,#0d0f16_100%)]" />
      <motion.div
        className="absolute inset-y-0 -inset-x-[10%] bg-[radial-gradient(circle_at_70%_65%,rgba(158,122,255,0.32),transparent_55%),radial-gradient(circle_at_15%_25%,rgba(45,212,191,0.16),transparent_50%)]"
        animate={{ x: ["0%", "-4%", "0%"] }}
        transition={{ duration: 18, ease: "easeInOut", repeat: Infinity }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_9%]" />

      {/* Clips widget, left column: the thing to watch while the chair is
          empty. Same trade as the starting screen, mirrored. */}
      <div
        className={chat ? "absolute top-[25%] left-[5%] w-[38%]" : "absolute top-[34%] left-[5%] w-[44%] @md:top-[31%]"}
      >
        <ClipsRotatorMini video={clipsVideo} />
        <ClipsCaption align="center">Clips while I&apos;m gone</ClipsCaption>
      </div>

      {/* Chat widget, under the clips, grown up from the bottom edge */}
      {chat ? <div className="absolute bottom-[6%] left-[5%] w-[38%]">{chat}</div> : null}

      {/* Text widget + countdown, right half, aligned to the edge */}
      <div className="absolute top-[32%] right-[5%] bottom-[10%] flex w-[42%] flex-col justify-center text-right">
        <p className="hidden text-[7px] font-semibold tracking-[0.22em] text-[#b9b9c6] uppercase @lg:block @lg:text-[9px] @3xl:text-xs">
          Short break
        </p>
        <p className="mt-0.5 text-[16px] leading-none font-extrabold tracking-tight whitespace-nowrap text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] @md:mt-1 @md:text-2xl @2xl:text-4xl @3xl:text-5xl">
          Be right back
        </p>
        <p className="mt-1 text-[7px] text-[#d4d4d8] @md:mt-2 @md:text-[10px] @3xl:text-sm">Chat is still open.</p>
        <div className="mt-2 flex items-baseline justify-end gap-1 @md:mt-4">
          <span className="text-[6px] font-semibold tracking-[0.2em] text-[#b9b9c6] uppercase @md:text-[8px] @3xl:text-[11px]">
            back in
          </span>
          <span className="text-[18px] leading-none font-bold tabular-nums text-[#9e7aff] drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] @md:text-3xl @2xl:text-5xl @3xl:text-6xl">
            {countdownLabel(BRB_COUNTDOWN_START, tick)}
          </span>
        </div>
      </div>
    </>
  );
}

/**
 * Connection lost: a centred stack, not a two-column split, and red where the
 * other two are purple. The auto switcher cuts here on its own when the feed
 * drops, so the screen has to say what happened without anyone typing it.
 */
export function ConnectionLostOverlay({ tick, clipsVideo = false, chat }: AwayOverlayProps) {
  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#2a1214_0%,#1a1119_55%,#0d0f16_100%)]" />
      <motion.div
        className="absolute inset-y-0 -inset-x-[10%] bg-[radial-gradient(circle_at_50%_30%,rgba(248,113,113,0.22),transparent_55%)]"
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_6%]" />

      {/* Notice bar, across the top */}
      <div className="absolute inset-x-[28%] top-[11%] flex items-center justify-center gap-1 rounded-full border border-red-400/25 bg-black/55 px-2 py-0.5 @md:gap-1.5 @md:py-1">
        <span className="h-1 w-1 animate-pulse rounded-full bg-red-400 motion-reduce:animate-none @md:h-1.5 @md:w-1.5" />
        <span className="text-[6px] font-semibold tracking-[0.2em] text-red-200/90 uppercase @md:text-[9px] @3xl:text-xs">
          Signal lost · reconnecting
        </span>
      </div>

      {/* Clips widget, centred: the stream is gone, the channel is not */}
      <div className="absolute top-[23%] left-1/2 w-[46%] -translate-x-1/2">
        <ClipsRotatorMini video={clipsVideo} />
        <ClipsCaption align="center">Clips from last stream</ClipsCaption>
      </div>

      {/* Chat widget, bottom left corner */}
      {chat ? <div className="absolute bottom-[7%] left-[4%] w-[30%]">{chat}</div> : null}

      {/* Text, bottom right, opposite the chat */}
      <div className="absolute right-[4%] bottom-[8%] w-[34%] text-right">
        <p className="text-[13px] leading-none font-extrabold tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] @md:text-xl @2xl:text-3xl @3xl:text-4xl">
          Hang tight
        </p>
        <p className="mt-1 text-[6px] text-[#d4d4d8] @md:mt-1.5 @md:text-[9px] @3xl:text-xs">
          Back the second the feed is up. Down <span className="tabular-nums">{mmss(tick)}</span>.
        </p>
      </div>
    </>
  );
}

/*
 * The ending screen runs a credits roll, because a stream is a production and
 * the joke writes itself. No clips here: the stream is over, and a rotator
 * inviting you to keep watching undercuts the goodbye.
 */
const CREDITS: { role: string; name: string }[] = [
  { role: "Directed by", name: "chat" },
  { role: "Camera", name: "a phone on a stick" },
  { role: "Catering", name: "gas station coffee" },
  { role: "Stunt work", name: "the canoe" },
  { role: "Animal wrangling", name: "one very willing cat" },
  { role: "Best boy", name: "ModMothra" },
  { role: "Weather", name: "not our fault" },
  { role: "Navigation", name: "chat, regrettably" },
];

/** How long the roll takes to travel one full copy of the list. */
const CREDITS_SECONDS = 22;
/** Nobody sits on an ended stream this long by accident. */
const EASTER_EGG_AFTER = 20;

function CreditsRoll() {
  return (
    <div className="absolute top-[14%] right-[6%] bottom-[10%] w-[36%] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_16%,black_84%,transparent)]">
      <MotionConfig reducedMotion="user">
        <motion.div
          className="flex flex-col gap-1 @md:gap-2 @3xl:gap-3"
          animate={{ y: ["0%", "-50%"] }}
          transition={{ duration: CREDITS_SECONDS, ease: "linear", repeat: Infinity }}
        >
          {/* Twice, so the loop point lands on an identical frame. */}
          {[0, 1].map((pass) =>
            CREDITS.map((credit) => (
              <div key={`${pass}-${credit.role}`} className="text-right">
                <p className="text-[5px] font-semibold tracking-[0.2em] text-[#b9b9c6] uppercase @md:text-[7px] @3xl:text-[10px]">
                  {credit.role}
                </p>
                <p className="text-[7px] leading-tight font-semibold text-white @md:text-[10px] @3xl:text-sm">
                  {credit.name}
                </p>
              </div>
            )),
          )}
        </motion.div>
      </MotionConfig>
    </div>
  );
}

/**
 * Ending: the goodbye left, the credits rolling right. Stay on it past the
 * credits and the screen notices, which is the whole easter egg.
 */
export function EndingOverlay({ tick, chat }: AwayOverlayProps) {
  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(150deg,#1c1524_0%,#141019_55%,#08090d_100%)]" />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_35%_45%,rgba(158,122,255,0.22),transparent_60%)]"
        animate={{ opacity: [0.6, 0.95, 0.6] }}
        transition={{ duration: 12, ease: "easeInOut", repeat: Infinity }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_35%,rgba(0,0,0,0.55)_100%)]" />

      {/* The goodbye, left */}
      <div className="absolute top-[26%] left-[6%] w-[46%]">
        <p className="hidden text-[7px] font-semibold tracking-[0.22em] text-[#b9b9c6] uppercase @lg:block @lg:text-[9px] @3xl:text-xs">
          That is a wrap
        </p>
        <p className="mt-0.5 text-[16px] leading-none font-extrabold tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] @md:mt-1 @md:text-2xl @2xl:text-4xl @3xl:text-5xl">
          Thanks for watching
        </p>
        <p className="mt-1 text-[7px] text-[#d4d4d8] @md:mt-2 @md:text-[10px] @3xl:text-sm">Same time Tuesday.</p>
        {tick >= EASTER_EGG_AFTER ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mt-1.5 text-[6px] text-[#9e7aff] @md:mt-3 @md:text-[9px] @3xl:text-xs"
          >
            Still here? The cat says hi. 🐈
          </motion.p>
        ) : null}
      </div>

      <CreditsRoll />

      {/* Chat widget, bottom left: the stream ends, chat does not */}
      {chat ? <div className="absolute bottom-[6%] left-[6%] w-[40%]">{chat}</div> : null}
    </>
  );
}
