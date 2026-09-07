"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@repo/supabase/next/client";
import { subscribeToWsRoomWith, wsStatusFromMessage, type WsRoomStatus } from "@repo/ui/overlay";
import { isSharedChatNotice } from "@repo/schemas";
import type {
  ChannelChatClearUserMessagesEvent,
  ChannelChatMessageDeleteEvent,
  ChannelChatMessageEvent,
  ChannelChatNotificationEvent,
} from "@repo/schemas";
import { useSession } from "@/providers/session-provider";
import { env } from "@/lib/env";
import { EVENT_CONFIG } from "@/lib/event-config";

/**
 * The deck's live chat + events feed.
 *
 * One filtered socket rather than one per concern: ws-server filters per
 * connection, so a single subscription costs one handshake on a phone that is
 * probably on mobile data. It mounts at the deck level, not inside the chat
 * panel, so switching tabs doesn't drop the buffer or churn the connection.
 */

/** Everything the chat pane renders, in arrival order. */
export type ChatEntry =
  | {
      kind: "message";
      id: string;
      at: number;
      message: ChannelChatMessageEvent;
      deleted: boolean;
      /** Optimistically appended by the composer, not yet echoed by Twitch. */
      pending?: boolean;
      failed?: boolean;
    }
  | { kind: "notice"; id: string; at: number; notification: ChannelChatNotificationEvent }
  /** An alert event mirrored inline, for the ones Twitch sends no chat notice for. */
  | { kind: "event"; id: string; at: number; type: string; payload: unknown }
  /** Locally generated divider: chat cleared, connection dropped, user banned. */
  | { kind: "system"; id: string; at: number; text: string };

/** An entry in the events pane. `type` keys into EVENT_CONFIG. */
export interface DeckEvent {
  id: string;
  at: number;
  type: string;
  payload: unknown;
}

/**
 * Chat types drive the message pane; the rest drive the events pane. Sent to
 * ws-server as the `channels` filter, so anything absent here never reaches
 * the browser at all.
 */
const CHAT_CHANNELS = [
  "channel.chat.message",
  "channel.chat.notification",
  "channel.chat.message_delete",
  "channel.chat.clear",
  "channel.chat.clear_user_messages",
] as const;

const EVENT_CHANNELS = [
  "channel.follow",
  "channel.subscribe",
  "channel.subscription.gift",
  "channel.subscription.message",
  "channel.cheer",
  "channel.raid",
  "channel.shoutout.create",
  "channel.shoutout.receive",
  // Only the redemption itself. The `.update` counterpart fires again when a
  // reward is approved or refunded, which would print the same redemption a
  // second time for no new information.
  "channel.channel_points_custom_reward_redemption.add",
  // Begin and end only, deliberately. Both of these also have `.progress`,
  // which fires on every single vote and every hype-train contribution — on a
  // busy channel that is hundreds of rows saying nothing the end state won't.
  "channel.poll.begin",
  "channel.poll.end",
  "channel.hype_train.begin",
  "channel.hype_train.end",
  "channel.ad_break.begin",
] as const;

const CHANNELS = [...CHAT_CHANNELS, ...EVENT_CHANNELS];

/**
 * Alert events Twitch also announces in chat itself, and which therefore must
 * not be mirrored inline a second time.
 *
 * Each of these arrives twice: once as the raw EventSub type, and once as a
 * `channel.chat.notification` carrying the wording Twitch composed — and that
 * second one is the better row, since it is also what holds a resub's message
 * text. So the notice wins inline and the raw event is dropped from the chat
 * flow. Both still reach the events pane, which is a log rather than a feed.
 *
 * Everything not listed here has no chat-side equivalent at all — follows,
 * shoutouts, channel points, polls, hype trains, ad breaks — so those are
 * mirrored inline, and are invisible in the message flow if they aren't.
 */
const EVENTS_ANNOUNCED_BY_CHAT_NOTICE = new Set([
  "channel.subscribe",
  "channel.subscription.message",
  "channel.subscription.gift",
  "channel.raid",
  // Not a notice, but the bits ride on the `channel.chat.message` that carried
  // them, which already renders with the cheermote and the amount.
  "channel.cheer",
]);

/**
 * Which notices also earn a row in the events pane.
 *
 * Everything except the `shared_chat_*` relays: those are the same notices
 * echoed from another channel during a shared chat session, so they belong in
 * the message flow as context but would pad the events log with activity that
 * didn't happen on this channel. Written as an exclusion rather than an
 * allowlist so notice types Twitch adds later show up by default instead of
 * being silently dropped.
 */
function noticeBelongsInEvents(noticeType: string): boolean {
  return !isSharedChatNotice(noticeType);
}

// Bounded so a deck left open all stream doesn't grow without limit. 300 rows
// is well past a phone screen and still a small enough DOM to skip virtualising.
const CHAT_LIMIT = 300;
const EVENT_LIMIT = 100;
// Frames are buffered and applied on a timer: a busy channel then costs ~10
// commits/s instead of one full-list render per message.
const FLUSH_MS = 100;
/** A pending message with no echo by now is assumed lost. */
const PENDING_TIMEOUT_MS = 5000;

let localIdCounter = 0;
function localId(prefix: string) {
  localIdCounter += 1;
  return `${prefix}:${localIdCounter}`;
}

interface Frame {
  type: string;
  payload: unknown;
}

interface FeedState {
  chat: ChatEntry[];
  events: DeckEvent[];
}

function clampChat(chat: ChatEntry[]) {
  return chat.length > CHAT_LIMIT ? chat.slice(chat.length - CHAT_LIMIT) : chat;
}

function clampEvents(events: DeckEvent[]) {
  return events.length > EVENT_LIMIT ? events.slice(events.length - EVENT_LIMIT) : events;
}

/**
 * Folds one socket frame into the feed. Returns the same object when nothing
 * changed so a batch of ignored frames costs no re-render.
 */
function applyFrame(state: FeedState, frame: Frame, now: number): FeedState {
  const { type, payload } = frame;

  switch (type) {
    case "channel.chat.message": {
      const message = payload as ChannelChatMessageEvent;
      // Our own message was already appended optimistically by the composer.
      const pendingIndex = state.chat.findIndex(
        (entry) => entry.kind === "message" && entry.pending && entry.id === message.message_id,
      );
      if (pendingIndex !== -1) {
        const chat = state.chat.slice();
        chat[pendingIndex] = {
          kind: "message",
          id: message.message_id,
          at: now,
          message,
          deleted: false,
        };
        return { ...state, chat };
      }
      return {
        ...state,
        chat: clampChat([
          ...state.chat,
          { kind: "message", id: message.message_id, at: now, message, deleted: false },
        ]),
      };
    }

    case "channel.chat.notification": {
      const notification = payload as ChannelChatNotificationEvent;
      const chat = clampChat([
        ...state.chat,
        { kind: "notice", id: notification.message_id, at: now, notification },
      ]);
      const events = noticeBelongsInEvents(notification.notice_type)
        ? clampEvents([
            ...state.events,
            { id: notification.message_id, at: now, type, payload },
          ])
        : state.events;
      return { chat, events };
    }

    case "channel.chat.message_delete": {
      const { message_id } = payload as ChannelChatMessageDeleteEvent;
      let found = false;
      const chat = state.chat.map((entry) => {
        if (entry.kind !== "message" || entry.id !== message_id || entry.deleted) return entry;
        found = true;
        return { ...entry, deleted: true };
      });
      return found ? { ...state, chat } : state;
    }

    case "channel.chat.clear_user_messages": {
      const { target_user_id, target_user_name } = payload as ChannelChatClearUserMessagesEvent;
      const chat = state.chat.map((entry) =>
        entry.kind === "message" && entry.message.chatter_user_id === target_user_id && !entry.deleted
          ? { ...entry, deleted: true }
          : entry,
      );
      return {
        ...state,
        chat: clampChat([
          ...chat,
          {
            kind: "system",
            id: localId("timeout"),
            at: now,
            text: `${target_user_name} was timed out or banned`,
          },
        ]),
      };
    }

    case "channel.chat.clear":
      // Only chat is cleared — the events pane is a separate record and a mod
      // clearing chat isn't asking to lose the raid that caused it.
      return {
        ...state,
        chat: [{ kind: "system", id: localId("clear"), at: now, text: "Chat was cleared" }],
      };

    default: {
      // Anything else in the filter set is an events-pane row.
      if (!EVENT_CHANNELS.includes(type as (typeof EVENT_CHANNELS)[number])) return state;
      if (!EVENT_CONFIG[type]) return state;

      // One id across both panes, so the same event is never counted twice.
      const id = localId("event");
      return {
        chat: EVENTS_ANNOUNCED_BY_CHAT_NOTICE.has(type)
          ? state.chat
          : clampChat([...state.chat, { kind: "event", id, at: now, type, payload }]),
        events: clampEvents([...state.events, { id, at: now, type, payload }]),
      };
    }
  }
}

export function useDeckChatRoom() {
  const user = useSession();
  const [feed, setFeed] = useState<FeedState>({ chat: [], events: [] });
  const [status, setStatus] = useState<WsRoomStatus>("connecting");
  const [unreadEvents, setUnreadEvents] = useState(0);

  const queueRef = useRef<Frame[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Nothing rendered before the first successful open, so a reconnect divider
  // only makes sense from the second one onwards.
  const hasConnectedRef = useRef(false);

  const flush = useCallback(() => {
    flushTimerRef.current = null;
    const frames = queueRef.current;
    if (frames.length === 0) return;
    queueRef.current = [];

    const now = Date.now();
    setFeed((prev) => {
      let next = prev;
      for (const frame of frames) next = applyFrame(next, frame, now);
      return next;
    });

    const newEvents = frames.filter(
      (frame) =>
        EVENT_CHANNELS.includes(frame.type as (typeof EVENT_CHANNELS)[number]) ||
        (frame.type === "channel.chat.notification" &&
          noticeBelongsInEvents((frame.payload as ChannelChatNotificationEvent).notice_type)),
    ).length;
    if (newEvents > 0) setUnreadEvents((count) => count + newEvents);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = setTimeout(flush, FLUSH_MS);
  }, [flush]);

  const room = useMemo(
    () => ({
      // Its own key, not the dashboard's: sharing a key would hand this
      // connection's `channels` filter to whichever subscriber connected first.
      roomKey: `deck-chat:${user.id}`,
      wsUrl: env.NEXT_PUBLIC_WS_SERVER_URL,
      channels: CHANNELS,
      getToken: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? "";
      },
    }),
    [user.id],
  );

  useEffect(() => {
    const unsubscribe = subscribeToWsRoomWith(room, (msg) => {
      const wsStatus = wsStatusFromMessage(msg);
      if (wsStatus) {
        setStatus(wsStatus);
        if (wsStatus === "connected") {
          if (hasConnectedRef.current) {
            // A local divider, so it's appended directly rather than routed
            // through applyFrame as a synthetic event type.
            setFeed((prev) => ({
              ...prev,
              chat: clampChat([
                ...prev.chat,
                {
                  kind: "system",
                  id: localId("reconnect"),
                  at: Date.now(),
                  text: "Reconnected — you may have missed messages",
                },
              ]),
            }));
          }
          hasConnectedRef.current = true;
        }
        return;
      }

      const frame = msg as Frame;
      if (typeof frame?.type !== "string") return;
      queueRef.current.push(frame);
      scheduleFlush();
    });

    return () => {
      unsubscribe();
      if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
      queueRef.current = [];
    };
  }, [room, scheduleFlush]);

  const markEventsRead = useCallback(() => setUnreadEvents(0), []);

  /**
   * Shows the sent message immediately, keyed by the id Helix returned, so the
   * echo arriving over the socket replaces this row instead of duplicating it.
   */
  const appendPendingMessage = useCallback(
    (messageId: string, message: ChannelChatMessageEvent) => {
      setFeed((prev) => ({
        ...prev,
        chat: clampChat([
          ...prev.chat,
          { kind: "message", id: messageId, at: Date.now(), message, deleted: false, pending: true },
        ]),
      }));

      setTimeout(() => {
        setFeed((prev) => {
          const index = prev.chat.findIndex(
            (entry) => entry.kind === "message" && entry.id === messageId && entry.pending,
          );
          if (index === -1) return prev;
          const chat = prev.chat.slice();
          const entry = chat[index] as Extract<ChatEntry, { kind: "message" }>;
          chat[index] = { ...entry, pending: false, failed: true };
          return { ...prev, chat };
        });
      }, PENDING_TIMEOUT_MS);
    },
    [],
  );

  return {
    chat: feed.chat,
    events: feed.events,
    status,
    unreadEvents,
    markEventsRead,
    appendPendingMessage,
  };
}

export type DeckChatRoom = ReturnType<typeof useDeckChatRoom>;
