"use client";

import { useCallback } from "react";
import type { ChannelChatMessageEvent } from "@repo/schemas";
import { useChatAssets } from "@/hooks/deck/use-chat-assets";
import type { DeckChatRoom } from "@/hooks/deck/use-deck-chat-room";
import { ChatComposer } from "@/components/deck/chat/chat-composer";
import { ChatList } from "@/components/deck/chat/chat-list";
import { EventsPane } from "@/components/deck/chat/events-pane";

/**
 * The chat tab: events ticker on top, chat filling the rest, composer pinned
 * above the tab bar. The room itself lives a level up in DeckContent so the
 * buffer and the socket survive switching tabs.
 */

interface DeckChatPanelProps {
  room: DeckChatRoom;
  broadcasterUserId: string | null;
  broadcasterUserName: string | null;
  broadcasterUserLogin: string | null;
  /** False when the Twitch integration is missing — read still works, sending doesn't. */
  canSend: boolean;
}

export function DeckChatPanel({
  room,
  broadcasterUserId,
  broadcasterUserName,
  broadcasterUserLogin,
  canSend,
}: DeckChatPanelProps) {
  const { assets, version } = useChatAssets(true);

  const handleSent = useCallback(
    (messageId: string, text: string) => {
      // A minimal stand-in for the EventSub echo — same shape, no fragments to
      // tokenize beyond plain text. The real event replaces it on arrival.
      const optimistic = {
        broadcaster_user_id: broadcasterUserId ?? "",
        broadcaster_user_login: broadcasterUserLogin ?? "",
        broadcaster_user_name: broadcasterUserName ?? "",
        chatter_user_id: broadcasterUserId ?? "",
        chatter_user_login: broadcasterUserLogin ?? "you",
        chatter_user_name: broadcasterUserName ?? "You",
        message_id: messageId,
        message: { text, fragments: [{ type: "text" as const, text }] },
        color: "",
        badges: [],
        message_type: "text" as const,
      } as ChannelChatMessageEvent;

      room.appendPendingMessage(messageId, optimistic);
    },
    [room, broadcasterUserId, broadcasterUserLogin, broadcasterUserName],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EventsPane events={room.events} unread={room.unreadEvents} onOpen={room.markEventsRead} />

      <ChatList
        entries={room.chat}
        assets={assets}
        assetsVersion={version}
        broadcasterUserId={broadcasterUserId ?? undefined}
        connected={room.status === "connected"}
      />

      <ChatComposer disabled={!canSend} onSent={handleSent} />
    </div>
  );
}
