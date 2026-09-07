"use client";

import { useEffect, useState } from "react";
import { cn } from "@repo/ui";
import { ChevronDown, Inbox } from "lucide-react";
import { EVENT_CONFIG } from "@/lib/event-config";
import type { DeckEvent } from "@/hooks/deck/use-deck-chat-room";

/**
 * Follows, subs, cheers, raids and shoutouts.
 *
 * Collapsed to a single ticker line by default, and expands over the chat
 * rather than squeezing it — resizing the chat pane would move the scroll
 * position and break its bottom pinning every time an event arrived.
 */

// Long enough to read a line, short enough that it's gone before it's in the way.
const AUTO_COLLAPSE_MS = 8000;

interface EventsPaneProps {
  events: DeckEvent[];
  unread: number;
  onOpen: () => void;
}

function eventLabel(event: DeckEvent): string {
  const config = EVENT_CONFIG[event.type];
  if (!config) return event.type;
  try {
    return config.label(event.payload);
  } catch {
    // A malformed payload from a shape change should cost one label, not the pane.
    return event.type;
  }
}

/**
 * Events worth interrupting for — ones the streamer has to react to while
 * they're happening, rather than notice afterwards.
 */
const HIGH_SIGNAL_TYPES = new Set([
  "channel.raid",
  "channel.hype_train.begin",
  // An IRL streamer needs to know they're in an ad break as it starts, not
  // after they've talked over it.
  "channel.ad_break.begin",
]);

function isHighSignal(event: DeckEvent): boolean {
  if (HIGH_SIGNAL_TYPES.has(event.type)) return true;
  if (event.type === "channel.subscription.gift") {
    return ((event.payload as { total?: number })?.total ?? 0) >= 5;
  }
  return false;
}

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function EventsPane({ events, unread, onOpen }: EventsPaneProps) {
  const [expanded, setExpanded] = useState(false);
  const [autoExpanded, setAutoExpanded] = useState(false);
  const [seenEventId, setSeenEventId] = useState<string | null>(null);
  const latest = events[events.length - 1];

  // Adjusted during render rather than in an effect, so the pane opens in the
  // same commit the raid lands in instead of a frame later.
  if (latest && latest.id !== seenEventId) {
    setSeenEventId(latest.id);
    if (isHighSignal(latest) && !expanded) {
      setExpanded(true);
      setAutoExpanded(true);
    }
  }

  // Only an auto-expansion times out. A deliberate tap stays open until tapped shut.
  useEffect(() => {
    if (!expanded || !autoExpanded) return;
    const id = setTimeout(() => {
      setAutoExpanded(false);
      setExpanded(false);
    }, AUTO_COLLAPSE_MS);
    return () => clearTimeout(id);
  }, [expanded, autoExpanded, events.length]);

  const toggle = () => {
    setAutoExpanded(false);
    setExpanded((open) => !open);
  };

  // Seeing the pane open is what clears the badge, however it got opened.
  useEffect(() => {
    if (expanded) onOpen();
  }, [expanded, onOpen]);

  const latestConfig = latest ? EVENT_CONFIG[latest.type] : undefined;
  const LatestIcon = latestConfig?.icon;

  return (
    <div className="relative shrink-0 border-b bg-card/80">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center gap-2 px-3 text-left"
      >
        {LatestIcon ? (
          <LatestIcon className={cn("h-4 w-4 shrink-0", latestConfig?.color)} />
        ) : (
          <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {latest ? eventLabel(latest) : "No events yet"}
        </span>
        {unread > 0 && !expanded ? (
          <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded ? (
        <div className="absolute inset-x-0 top-full z-20 max-h-[45dvh] overflow-y-auto overscroll-contain border-b bg-card/95 backdrop-blur">
          {events.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Follows, subs, cheers and raids land here.
            </p>
          ) : (
            [...events].reverse().map((event) => {
              const config = EVENT_CONFIG[event.type];
              const Icon = config?.icon ?? Inbox;
              return (
                <div key={event.id} className="flex items-start gap-2 px-3 py-2">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config?.color)} />
                  <p className="min-w-0 flex-1 text-xs leading-relaxed">{eventLabel(event)}</p>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {formatTime(event.at)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
