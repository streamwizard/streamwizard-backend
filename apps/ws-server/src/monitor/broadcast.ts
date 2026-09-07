import type { ConnectionData, ServerWebSocket } from "../types";
import type { BotConnSnapshot, ConnectionSnapshot, ConsumerConnSnapshot, MonitorEnvelope, MonitorNodeBandwidth, MonitorSnapshot, RoomSnapshot } from "./types";
import { rooms } from "../rooms";
import { consumers } from "../consumers";
import { getLiveIngestNodes } from "../ingest-nodes";

export const monitors = new Set<ServerWebSocket<ConnectionData>>();

// All connected bot sockets, keyed by connId. A Map (not a single slot):
// several bots are connected at once — the overlay bot plus one per ingest
// node — and a singleton meant last-writer-wins on connect and any one
// disconnect wiping the registration of the survivors.
const botSockets = new Map<string, ServerWebSocket<ConnectionData>>();

export function addBotSocket(ws: ServerWebSocket<ConnectionData>): void {
  botSockets.set(ws.data.connId, ws);
}

export function removeBotSocket(ws: ServerWebSocket<ConnectionData>): void {
  botSockets.delete(ws.data.connId);
}

export function getBotSockets(): ReadonlyMap<string, ServerWebSocket<ConnectionData>> {
  return botSockets;
}

function maskRoomId(userId: string): string {
  if (userId.length <= 8) return userId.slice(0, 2) + "***";
  return userId.slice(0, 4) + "…" + userId.slice(-4);
}

export function broadcastToMonitors(envelope: MonitorEnvelope): void {
  if (monitors.size === 0) return;

  const masked: MonitorEnvelope = {
    ...envelope,
    roomId: maskRoomId(envelope.roomId),
  };

  const msg = JSON.stringify(masked);
  for (const ws of monitors) {
    ws.send(msg);
  }
}

// Live per-node bandwidth forward. Separate from broadcastToMonitors because
// there is no roomId to mask — masking would mangle a node id.
export function broadcastNodeBandwidth(message: MonitorNodeBandwidth): void {
  if (monitors.size === 0) return;

  const msg = JSON.stringify(message);
  for (const ws of monitors) {
    ws.send(msg);
  }
}

export function buildRoomSnapshot(): MonitorSnapshot {
  const roomSnapshots: RoomSnapshot[] = [];
  let totalConnections = 0;

  for (const [userId, room] of rooms.entries()) {
    const subCount = room.subscribers.size;
    const hasPub = room.publisher !== null;
    totalConnections += subCount + (hasPub ? 1 : 0);

    const connections: ConnectionSnapshot[] = [];

    if (room.publisher) {
      const d = room.publisher.data;
      connections.push({
        connId: d.connId,
        role: "publisher",
        connectedAt: d.connectedAt,
        channels: [],
      });
    }

    for (const sub of room.subscribers) {
      const d = sub.data;
      connections.push({
        connId: d.connId,
        role: "subscriber",
        connectedAt: d.connectedAt,
        channels: Array.from(d.channels),
      });
    }

    roomSnapshots.push({
      roomId: maskRoomId(userId),
      hasPublisher: hasPub,
      subscriberCount: subCount,
      sessionId: room.session_id,
      streamId: room.stream_id,
      connections,
    });
  }

  const bots: BotConnSnapshot[] = [...botSockets.values()].map((ws) => ({
    connId: ws.data.connId,
    connectedAt: ws.data.connectedAt,
    source: ws.data.source ?? "unknown",
  }));

  const consumerSnapshots: ConsumerConnSnapshot[] = [...consumers].map((ws) => ({
    connId: ws.data.connId,
    connectedAt: ws.data.connectedAt,
    source: ws.data.source ?? "unknown",
    types: [...(ws.data.consumerTypes ?? [])],
  }));

  const { nodes: ingestNodes, fleet: ingestFleet } = getLiveIngestNodes();

  return {
    ts: Date.now(),
    kind: "snapshot",
    rooms: roomSnapshots,
    totalConnections: totalConnections + bots.length + consumerSnapshots.length,
    // Legacy single-bot field, derived so older monitor UIs keep working.
    bot: {
      connected: bots.length > 0,
      connId: bots[0]?.connId ?? null,
      connectedAt: bots[0]?.connectedAt ?? null,
    },
    bots,
    consumers: consumerSnapshots,
    ingestNodes,
    ingestFleet,
  };
}

export function broadcastSnapshot(): void {
  if (monitors.size === 0) return;

  const snapshot = buildRoomSnapshot();
  const msg = JSON.stringify(snapshot);
  for (const ws of monitors) {
    ws.send(msg);
  }
}
