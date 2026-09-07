"use client";

import { useSwitcherDemo, useSwitcherViewport, type NoticeKind } from "./switcher-demo-store";

/*
 * What chat saw during the walk running further up the page. The messages are
 * the shipped default templates with this walk's own numbers in them, so the
 * placeholders in the cards next to it are not a promise, they are the thing
 * that just happened.
 */

const KIND_LABEL: Record<NoticeKind, string> = {
  degraded: "Quality dropped",
  offline: "Signal lost",
  recovered: "Back live",
};

export function ChatNoticeFeed() {
  const { notices } = useSwitcherDemo();
  const ref = useSwitcherViewport<HTMLDivElement>();

  return (
    <div ref={ref} className="flex h-full min-h-[15rem] flex-col rounded-xl border border-white/[0.08] bg-black/30 p-4">
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Your Twitch chat</p>

      <div className="mt-4 flex-1 space-y-3" aria-live="polite">
        {notices.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing yet. The walk above has not gone wrong, so chat has not been told anything.
          </p>
        ) : (
          notices.map((notice) => (
            <div key={notice.id}>
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                {KIND_LABEL[notice.kind]}
                <span className="ml-2 normal-case tabular-nums">{notice.at}s</span>
              </p>
              <p className="mt-1 text-sm leading-relaxed break-words">
                <span className="font-semibold text-purple-300">you</span>
                <span className="text-muted-foreground">: </span>
                <span className="text-foreground">{notice.text}</span>
              </p>
            </div>
          ))
        )}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Sent as the broadcaster. No bot account in your mod list, no command for chat to spam.
      </p>
    </div>
  );
}
