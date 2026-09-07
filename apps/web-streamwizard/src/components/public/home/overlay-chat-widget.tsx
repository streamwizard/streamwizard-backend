"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView } from "motion/react";

/*
 * The chat widget as it sits on a stream: badges, the name in the colour the
 * chatter picked, and the emotes people type, from Twitch and from 7TV,
 * BetterTTV and FrankerFaceZ. Drawn, not fetched: a landing page has no
 * business hitting three emote CDNs, and a deleted emote would leave a hole.
 *
 * Sized by the demo frame's container queries, like every other widget in
 * there. Messages arrive on a timer while the frame is on screen and the
 * oldest drops off, so the column never grows past its corner. The first three
 * are fixed, so server and client paint the same frame.
 */

type Provider = "7tv" | "bttv" | "ffz" | "twitch";

/** Emotes are images on a real stream; at this scale, a tinted tile per source. */
const EMOTE_STYLE: Record<Provider, string> = {
  "7tv": "from-purple-400 to-indigo-500",
  bttv: "from-red-400 to-rose-600",
  ffz: "from-sky-400 to-blue-600",
  twitch: "from-violet-400 to-fuchsia-600",
};

type Badge = "mod" | "sub" | "vip";

const BADGE_STYLE: Record<Badge, string> = {
  mod: "bg-[#00ad03]",
  sub: "bg-[#9146ff]",
  vip: "bg-[#e005b9]",
};

interface Part {
  text?: string;
  emote?: Provider;
}

interface Line {
  id: string;
  name: string;
  color: string;
  badges: Badge[];
  parts: Part[];
}

/* The same chatters who sit in the deck demo, with their own colours. */
const LINES: Line[] = [
  {
    id: "1",
    name: "pixelgremlin",
    color: "#00D4AA",
    badges: ["sub"],
    parts: [{ text: "that clip goes hard" }, { emote: "7tv" }],
  },
  {
    id: "2",
    name: "ModMothra",
    color: "#FF7F50",
    badges: ["mod"],
    parts: [{ text: "two minutes on the timer, chat behave" }, { emote: "twitch" }],
  },
  {
    id: "3",
    name: "toastcrumb",
    color: "#9146FF",
    badges: [],
    parts: [{ emote: "bttv" }, { text: "he has set it three times already" }],
  },
  {
    id: "4",
    name: "ninetoad",
    color: "#00FF7F",
    badges: ["sub"],
    parts: [{ text: "first time catching this live" }, { emote: "ffz" }],
  },
  {
    id: "5",
    name: "sandwichlord",
    color: "#FF69B4",
    badges: ["vip"],
    parts: [{ text: "the overlay knows the weather now" }, { emote: "7tv" }],
  },
  {
    id: "6",
    name: "bitrate_gremlin",
    color: "#1E90FF",
    badges: [],
    parts: [{ text: "drink some water btw" }, { emote: "twitch" }],
  },
];

const WINDOW = 3;
const LINE_MS = 2800;

function Emote({ provider }: { provider: Provider }) {
  return (
    <span
      className={
        "mx-[1px] inline-block size-2 rounded-[2px] bg-linear-to-br align-middle @md:size-3 @xl:size-3.5 @3xl:size-5 " +
        EMOTE_STYLE[provider]
      }
    />
  );
}

/** Render inside a positioned wrapper; the lines size themselves to the frame. */
export function OverlayChatWidget() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-48px" });
  const [next, setNext] = useState(WINDOW);

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setNext((n) => n + 1), LINE_MS);
    return () => clearInterval(id);
  }, [inView]);

  const visible = Array.from({ length: WINDOW }, (_, i) => {
    const step = next - WINDOW + i;
    const line = LINES[step % LINES.length];
    // The key carries the pass number: the same chatter coming back around
    // would otherwise reuse the row that is on its way out.
    return { ...line, key: `${line.id}-${Math.floor(step / LINES.length)}` };
  });

  return (
    <div ref={ref} className="flex flex-col justify-end gap-px @md:gap-0.5 @3xl:gap-1">
      <MotionConfig reducedMotion="user">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((line) => (
            <motion.p
              key={line.key}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="text-[6px] leading-snug text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] @md:text-[8px] @xl:text-[10px] @3xl:text-[13px]"
            >
              {line.badges.map((badge) => (
                <span
                  key={badge}
                  className={
                    "mr-[2px] inline-block size-[5px] rounded-[1px] align-middle @md:size-2 @3xl:size-3 " +
                    BADGE_STYLE[badge]
                  }
                />
              ))}
              <span className="font-bold" style={{ color: line.color }}>
                {line.name}
              </span>
              <span className="text-white/70">: </span>
              {line.parts.map((part, i) =>
                part.emote ? <Emote key={i} provider={part.emote} /> : <span key={i}>{part.text}</span>,
              )}
            </motion.p>
          ))}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
}
