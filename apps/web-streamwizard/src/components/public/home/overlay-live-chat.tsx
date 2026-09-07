"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { twitchEmoteUrl } from "@repo/ui/chat";
import { useObsDemo } from "./obs-demo-store";

/*
 * The chat widget on the stream, reading the demo store rather than a script of
 * its own. That is the whole point of it: the deck, the OBS window and this
 * overlay are one fake stream, so a message typed into the deck's chat tab
 * shows up on the away screens the same second, the way a real chat widget
 * would. The ambient chatter the deck generates flows through here too.
 *
 * Sized by the frame's container queries, like every other widget in the demo.
 * Only the last few lines are kept on screen so the column never grows past
 * its corner.
 *
 * Must be rendered inside <ObsDemoProvider>; the overlay section's demo frame
 * has no store, which is why the away screens take this as a slot instead of
 * reaching for it themselves.
 */

const WINDOW = 3;

/** Render inside a positioned wrapper; the lines size themselves to the frame. */
export function OverlayLiveChat() {
  const { chat } = useObsDemo();
  const visible = chat.slice(-WINDOW);

  return (
    <div className="flex flex-col justify-end gap-px @md:gap-0.5 @3xl:gap-1">
      <MotionConfig reducedMotion="user">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((entry) => (
            <motion.p
              key={entry.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="text-[6px] leading-snug text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] @md:text-[8px] @xl:text-[10px] @3xl:text-[13px]"
            >
              {entry.badges.map((badge) =>
                badge.url_2x ? (
                  <img
                    key={badge.set_id}
                    src={badge.url_2x}
                    alt=""
                    className="mr-[2px] inline-block size-[5px] rounded-[1px] align-middle @md:size-2 @3xl:size-3"
                  />
                ) : null,
              )}
              <span className="font-bold" style={{ color: entry.color }}>
                {entry.name}
              </span>
              <span className="text-white/70">: </span>
              {entry.fragments.map((fragment, i) =>
                fragment.emote ? (
                  <img
                    key={i}
                    src={twitchEmoteUrl(fragment.emote.id)}
                    alt={fragment.text}
                    className="mx-[1px] inline-block size-2 align-middle @md:size-3 @xl:size-3.5 @3xl:size-5"
                  />
                ) : (
                  <span key={i}>{fragment.text}</span>
                ),
              )}
            </motion.p>
          ))}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
}
