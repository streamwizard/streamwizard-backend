import type { ConnectionData, ServerWebSocket } from "./types";

// Trusted server-side consumers (obs-auto-switcher) that receive every
// bot-routed message across ALL user rooms, unmasked — unlike monitors
// (sanitized/masked observability) and subscribers (own room only). The
// role is gated on CONSUMER_SECRET, never a user token.
export const consumers = new Set<ServerWebSocket<ConnectionData>>();

export function addConsumer(ws: ServerWebSocket<ConnectionData>): void {
  consumers.add(ws);
}

export function removeConsumer(ws: ServerWebSocket<ConnectionData>): void {
  consumers.delete(ws);
}

export function broadcastToConsumers(userId: string, type: string, payload: unknown): void {
  if (consumers.size === 0) return;

  const msg = JSON.stringify({ userId, type, payload, ts: Date.now() });
  for (const ws of consumers) {
    const filter = ws.data.consumerTypes;
    if (filter && filter.size > 0 && !filter.has(type)) continue;
    ws.send(msg);
  }
}
