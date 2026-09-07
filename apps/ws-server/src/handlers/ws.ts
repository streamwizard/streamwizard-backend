import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { insertIrlGeoTrack } from "@repo/supabase/queries/irl";
import type { BotOutboundMessage, PublisherMessage } from "@repo/types";
import { trackWsConnection, trackWsMessage, trackWsMessageDrop, trackWsRoomEvent } from "@repo/metrics";
import { rooms, broadcastToRoom } from "../rooms";
import { monitors, broadcastToMonitors, broadcastNodeBandwidth, broadcastSnapshot, addBotSocket, removeBotSocket } from "../monitor";
import { addConsumer, removeConsumer } from "../consumers";
import { routeBotBroadcast } from "../bot-router";
import { updateNodeBandwidth } from "../ingest-nodes";
import type { ConnectionData, ServerWebSocket } from "../types";

export const websocketHandlers = {
  open(ws: ServerWebSocket<ConnectionData>): void {
    const { role, userId } = ws.data;

    if (role === "monitor") {
      monitors.add(ws);
      broadcastSnapshot();
      console.log("[monitor] connected");
      return;
    }

    trackWsConnection(role, "open", undefined, ws.data.source);

    if (role === "publisher") {
      const room = rooms.get(userId);
      if (room) {
        // Same claim rule as the message() gate: a connecting socket only
        // becomes primary when the slot is free or the primary has gone
        // silent. "Newest connection wins" would let any second page (OBS
        // browser source, desktop tab) steal the slot from an actively
        // walking phone and cost it 15s of dropped fixes.
        const primarySilent = Date.now() - (room.lastGeoAt ?? 0) > 15_000;
        if (!room.publisher) {
          trackWsRoomEvent("publisher_joined");
          room.publisher = ws;
        } else if (primarySilent) {
          trackWsRoomEvent("publisher_replaced");
          room.publisher = ws;
        }
      }
      broadcastToMonitors({
        ts: Date.now(),
        kind: "connect",
        direction: "system",
        role: "publisher",
        roomId: userId,
        meta: { subscriberCount: rooms.get(userId)?.subscribers.size ?? 0, hasPublisher: true, sessionId: ws.data.session_id },
      });
    } else if (role === "bot") {
      addBotSocket(ws);
      console.log(`[bot] connected source=${ws.data.source ?? "unknown"}`);
      broadcastToMonitors({ ts: Date.now(), kind: "connect", direction: "system", role: "bot", roomId: "_bot", source: ws.data.source });
    } else if (role === "consumer") {
      addConsumer(ws);
      console.log(`[consumer] connected source=${ws.data.source ?? "unknown"} types=${[...(ws.data.consumerTypes ?? [])].join(",") || "*"}`);
      broadcastToMonitors({ ts: Date.now(), kind: "connect", direction: "system", role: "consumer", roomId: "_consumer", source: ws.data.source });
    } else {
      const room = rooms.get(userId);
      if (room) {
        room.subscribers.add(ws);
      } else {
        rooms.set(userId, {
          publisher: null,
          subscribers: new Set([ws]),
          session_id: "",
          stream_id: null,
        });
        trackWsRoomEvent("created");
        broadcastToMonitors({ ts: Date.now(), kind: "room", direction: "system", role: "subscriber", roomId: userId, eventType: "room_created" });
      }
      broadcastToMonitors({
        ts: Date.now(),
        kind: "connect",
        direction: "system",
        role: "subscriber",
        roomId: userId,
        meta: { subscriberCount: rooms.get(userId)?.subscribers.size ?? 0, hasPublisher: rooms.get(userId)?.publisher !== null },
      });
      console.log(`[subscriber] connected userId=${userId} channels=${[...ws.data.channels].join(",") || "*"}`);
    }
  },

  message(ws: ServerWebSocket<ConnectionData>, raw: string | Buffer): void {
    const { role, userId, session_id } = ws.data;

    // Monitors and consumers are receive-only.
    if (role === "monitor" || role === "consumer") return;

    const rawStr = typeof raw === "string" ? raw : raw.toString();

    // --- Bot: node metrics or fan-out to a target user's room ---
    if (role === "bot") {
      // Re-register on every message (Map.set by connId — effectively free).
      // The registry fills at open(), but a dev --hot reload resets module
      // state while sockets stay open: bandwidth state self-heals because
      // it's message-driven, and without this the bot would stay invisible
      // in the snapshot/topology until it reconnected.
      addBotSocket(ws);

      let msg: BotOutboundMessage;
      try {
        msg = JSON.parse(rawStr) as BotOutboundMessage;
      } catch {
        console.warn("[bot] malformed message");
        trackWsMessageDrop("bot", "malformed_json");
        return;
      }

      // Node-scoped messages: never room-routed. (`kind` only exists on
      // node-scoped messages, so `in` splits them from fan-out broadcasts.)
      if ("kind" in msg) {
        // Heartbeat echo — the bot client uses the pong to tell a healthy
        // link from a half-open TCP connection.
        if (msg.kind === "ping") {
          ws.send(JSON.stringify({ kind: "pong", ts: msg.ts }));
          return;
        }

        // Metrics fold into the per-node bandwidth state (feeds the 5s
        // snapshot) and forward live to monitors.
        const p = msg.payload;
        if (typeof p?.node_id !== "string" || p.node_id.length === 0 || typeof p.rx_bytes_per_sec !== "number" || typeof p.tx_bytes_per_sec !== "number") {
          trackWsMessageDrop("bot", "malformed_node_metrics");
          return;
        }
        trackWsMessage("bot", "node_metrics", ws.data.source);
        updateNodeBandwidth(p);
        broadcastNodeBandwidth({ ts: Date.now(), kind: "node_bandwidth", source: ws.data.source, payload: p });
        return;
      }

      // A broadcast without a target user can't be routed or mirrored
      // (maskRoomId needs a string) — treat it as malformed.
      if (typeof msg.userId !== "string" || msg.userId.length === 0) {
        trackWsMessageDrop("bot", "malformed_json");
        return;
      }

      routeBotBroadcast(msg, ws.data.source);
      return;
    }

    if (role !== "publisher") return;

    let msg: PublisherMessage;
    try {
      msg = JSON.parse(rawStr) as PublisherMessage;
    } catch {
      console.warn(`[publisher] malformed message from userId=${userId}`);
      trackWsMessageDrop("publisher", "malformed_json");
      return;
    }
    trackWsMessage("publisher", msg.type ?? "unknown");

    const room = rooms.get(userId);
    if (!room) {
      trackWsMessageDrop("publisher", "room_not_found");
      return;
    }

    if (msg.type === "geo") {
      // One publisher per room. A user can run two GPS overlay pages at once
      // (two scenes in IRL Pro, a phone plus a desktop tab) and each one auths
      // its own publisher socket; without this gate every socket broadcasts and
      // logs, so subscribers see interleaved duplicate fixes and the geo table
      // records the same walk under multiple sessions. Standby geo is dropped —
      // unless the slot is free or the primary has gone silent, in which case
      // the sender takes over so a half-open primary socket can't keep the
      // room dark. The gate lives inside the geo branch so only actual geo
      // traffic can claim the slot, and an accepted takeover stamps lastGeoAt
      // immediately (below) so two standbys can't leapfrog each other off one
      // silent window.
      if (room.publisher !== ws) {
        const primarySilent = Date.now() - (room.lastGeoAt ?? 0) > 15_000;
        if (room.publisher !== null && !primarySilent) {
          trackWsMessageDrop("publisher", "not_primary");
          return;
        }
        trackWsRoomEvent(room.publisher === null ? "publisher_joined" : "publisher_replaced");
        room.publisher = ws;
      }

      const geo = msg.payload;
      room.lastGeoAt = Date.now();
      broadcastToRoom(room, "streamwizard.geo", { status: "connected", payload: geo });
      broadcastToMonitors({
        ts: Date.now(),
        kind: "message",
        direction: "inbound",
        role: "publisher",
        roomId: userId,
        eventType: "streamwizard.geo",
        meta: { subscriberCount: room.subscribers.size },
      });

      // Devices fire fixes faster than 1/s and keep firing while parked, so
      // gate the log: full rate while moving (that's the data walks are
      // replayed from when tuning distance math), one row per 10s otherwise.
      // Broadcasts above are untouched — viewers always get the live rate.
      const moving = typeof geo.speed === "number" && geo.speed >= 0.5;
      const sinceInsert = Date.now() - (room.lastGeoInsertAt ?? 0);
      const shouldLog = moving ? sinceInsert >= 900 : sinceInsert >= 10_000;

      if (session_id && shouldLog) {
        room.lastGeoInsertAt = Date.now();
        insertIrlGeoTrack(supabase, {
          user_id: userId,
          session_id,
          stream_id: room.stream_id,
          latitude: geo.latitude,
          longitude: geo.longitude,
          altitude: geo.altitude,
          speed: geo.speed,
          heading: geo.heading,
          accuracy: geo.accuracy,
          recorded_at: new Date(geo.timestamp).toISOString(),
        }).then(({ error }) => {
          // Returned as a value, never thrown — without this a broken geo
          // insert loses the whole track and nothing anywhere says so.
          if (error) reportError(error, "ws.geo-insert", { userId, session_id });
        });
      }
    }
  },

  close(ws: ServerWebSocket<ConnectionData>): void {
    const { role, userId, connectedAt } = ws.data;
    const durationMs = Date.now() - connectedAt;

    if (role === "monitor") {
      monitors.delete(ws);
      console.log("[monitor] disconnected");
      return;
    }

    trackWsConnection(role, "close", durationMs, ws.data.source);

    if (role === "bot") {
      removeBotSocket(ws);
      console.log(`[bot] disconnected source=${ws.data.source ?? "unknown"}`);
      broadcastToMonitors({ ts: Date.now(), kind: "disconnect", direction: "system", role: "bot", roomId: "_bot", source: ws.data.source, meta: { durationMs } });
      return;
    }

    if (role === "consumer") {
      removeConsumer(ws);
      console.log(`[consumer] disconnected source=${ws.data.source ?? "unknown"}`);
      broadcastToMonitors({ ts: Date.now(), kind: "disconnect", direction: "system", role: "consumer", roomId: "_consumer", source: ws.data.source, meta: { durationMs } });
      return;
    }

    if (role === "publisher") {
      const room = rooms.get(userId);
      if (room) {
        // Only the primary's departure changes room state. A standby socket
        // (second overlay page) closing must not broadcast offline or null
        // out a primary that is still publishing.
        if (room.publisher === ws) {
          broadcastToRoom(room, "streamwizard.geo", { status: "offline" });
          room.publisher = null;
          trackWsRoomEvent("publisher_left");
        }
        broadcastToMonitors({
          ts: Date.now(),
          kind: "disconnect",
          direction: "system",
          role: "publisher",
          roomId: userId,
          meta: { durationMs, subscriberCount: room.subscribers.size, hasPublisher: room.publisher !== null },
        });
        if (!room.publisher && room.subscribers.size === 0) {
          rooms.delete(userId);
          trackWsRoomEvent("deleted");
          broadcastToMonitors({ ts: Date.now(), kind: "room", direction: "system", role: "publisher", roomId: userId, eventType: "room_deleted" });
        }
        console.log(`[publisher] disconnected userId=${userId}`);
      }
    } else {
      const room = rooms.get(userId);
      if (room) {
        room.subscribers.delete(ws);
        broadcastToMonitors({
          ts: Date.now(),
          kind: "disconnect",
          direction: "system",
          role: "subscriber",
          roomId: userId,
          meta: { durationMs, subscriberCount: room.subscribers.size, hasPublisher: room.publisher !== null },
        });
        if (!room.publisher && room.subscribers.size === 0) {
          rooms.delete(userId);
          trackWsRoomEvent("deleted");
          broadcastToMonitors({ ts: Date.now(), kind: "room", direction: "system", role: "subscriber", roomId: userId, eventType: "room_deleted" });
        }
      }
      console.log(`[subscriber] disconnected userId=${userId}`);
    }
  },
};
