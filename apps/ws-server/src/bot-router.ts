import type { BotBroadcastMessage } from "@repo/types";
import { trackWsMessage, trackWsMessageDrop } from "@repo/metrics";
import { rooms, broadcastToRoom } from "./rooms";
import { broadcastToMonitors, sanitizePayload } from "./monitor";
import { broadcastToConsumers } from "./consumers";

/**
 * Single routing path for a `{userId, type, payload}` bot broadcast, shared
 * by the bot WS message handler and POST /internal/broadcast: mirror to
 * monitors, fan out to trusted consumers (even when no room exists — the
 * obs-auto-switcher must see stats while no dashboard is open), then deliver
 * to the user's room subscribers.
 */
export function routeBotBroadcast(msg: BotBroadcastMessage, source?: string): { delivered: boolean } {
  trackWsMessage("bot", msg.type ?? "unknown", source);

  const room = rooms.get(msg.userId);
  // Mirror to monitors even when nobody subscribes — ops needs to see
  // stream stats for users whose dashboard isn't open. `delivered` tells
  // the two cases apart.
  broadcastToMonitors({
    ts: Date.now(),
    kind: "message",
    direction: "inbound",
    role: "bot",
    roomId: msg.userId,
    eventType: msg.type,
    payload: sanitizePayload(msg.payload),
    source,
    meta: { subscriberCount: room?.subscribers.size ?? 0, delivered: !!room },
  });

  broadcastToConsumers(msg.userId, msg.type, msg.payload);

  if (!room) {
    trackWsMessageDrop("bot", "room_not_found");
    return { delivered: false };
  }
  broadcastToRoom(room, msg.type, msg.payload);
  return { delivered: true };
}
