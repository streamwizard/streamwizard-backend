"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@repo/ui";
import type { ChatAssets } from "@repo/ui/chat";
import { ArrowDown, MessageSquare } from "lucide-react";
import type { ChatEntry } from "@/hooks/deck/use-deck-chat-room";
import { ChatRow } from "@/components/deck/chat/chat-row";

/**
 * The scrolling chat pane.
 *
 * Autoscroll is pinned-based rather than unconditional: a streamer who has
 * scrolled up to read something must not be yanked back down by the next
 * message. While unpinned, new arrivals are counted and offered as a pill.
 */

// Generous enough that momentum scrolling settling a pixel short still counts
// as being at the bottom.
const PIN_THRESHOLD_PX = 48;

interface ChatListProps {
  entries: ChatEntry[];
  assets: ChatAssets;
  assetsVersion: number;
  broadcasterUserId?: string;
  connected: boolean;
}

export function ChatList({
  entries,
  assets,
  assetsVersion,
  broadcasterUserId,
  connected,
}: ChatListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const [missed, setMissed] = useState(0);
  const lastCountRef = useRef(entries.length);

  const scrollToBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
    setPinned(atBottom);
    if (atBottom) setMissed(0);
  }, []);

  // Layout effect, not effect: the scroll happens in the same frame as the new
  // rows paint, so the list never visibly jumps.
  useLayoutEffect(() => {
    const added = entries.length - lastCountRef.current;
    lastCountRef.current = entries.length;
    if (pinned) {
      scrollToBottom();
    } else if (added > 0) {
      setMissed((count) => count + added);
    }
  }, [entries.length, pinned, scrollToBottom]);

  // Emote and badge images have explicit dimensions, so they don't reflow — but
  // the very first paint can still land before the scroller has its height.
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const jumpToLatest = () => {
    setPinned(true);
    setMissed(0);
    scrollToBottom();
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2"
      >
        {entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="text-sm text-muted-foreground">
              {connected
                ? "Nothing yet. New chat shows up here as it comes in."
                : "Connecting to your chat…"}
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <ChatRow
              key={entry.id}
              entry={entry}
              assets={assets}
              assetsVersion={assetsVersion}
              broadcasterUserId={broadcasterUserId}
            />
          ))
        )}
      </div>

      {missed > 0 ? (
        <button
          type="button"
          onClick={jumpToLatest}
          className={cn(
            "absolute inset-x-0 bottom-2 mx-auto flex w-fit items-center gap-2 rounded-full",
            "bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg",
          )}
        >
          <ArrowDown className="h-3.5 w-3.5" />
          {missed} new message{missed === 1 ? "" : "s"}
        </button>
      ) : null}
    </div>
  );
}
