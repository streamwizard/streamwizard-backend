"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export type MonitorEnvelope = {
  ts: number;
  kind: "message" | "connect" | "disconnect" | "room";
  direction: "inbound" | "outbound" | "system";
  role: "publisher" | "subscriber" | "bot" | "consumer";
  roomId: string;
  eventType?: string;
  payload?: unknown;
  /** Bot self-declared identity ("ingest-node:<id>"), when the sender is a bot. */
  source?: string;
  meta?: {
    subscriberCount?: number;
    hasPublisher?: boolean;
    durationMs?: number;
    sessionId?: string;
    /** Bot messages: false when no room existed (mirrored for ops anyway). */
    delivered?: boolean;
  };
};

/** Latest bandwidth reading for one ingest node (host NIC totals). */
export type IngestNodeLive = {
  nodeId: string;
  ts: number;
  rxBps: number;
  txBps: number;
  tsRxBps: number;
  tsTxBps: number;
};

export type BotConnSnapshot = {
  connId: string;
  connectedAt: number;
  source: string;
};

export type ConsumerConnSnapshot = {
  connId: string;
  connectedAt: number;
  source: string;
  /** Message-type filter the consumer subscribed with (empty = everything). */
  types: string[];
};

/** Live per-node bandwidth sample forwarded outside the envelope/snapshot flow. */
export type MonitorNodeBandwidth = {
  ts: number;
  kind: "node_bandwidth";
  source?: string;
  payload: {
    node_id: string;
    ts: number;
    rx_bytes_per_sec: number;
    tx_bytes_per_sec: number;
    tailscale_rx_bytes_per_sec: number;
    tailscale_tx_bytes_per_sec: number;
  };
};

export type ConnectionSnapshot = {
  connId: string;
  role: "publisher" | "subscriber";
  connectedAt: number;
  channels: string[];
};

export type RoomSnapshot = {
  roomId: string;
  hasPublisher: boolean;
  subscriberCount: number;
  sessionId: string;
  streamId: string | null;
  connections: ConnectionSnapshot[];
};

export type BotSnapshot = {
  connected: boolean;
  connId: string | null;
  connectedAt: number | null;
};

export type MonitorSnapshot = {
  ts: number;
  kind: "snapshot";
  rooms: RoomSnapshot[];
  totalConnections: number;
  /** Legacy single-bot view — prefer `bots`. */
  bot: BotSnapshot;
  bots: BotConnSnapshot[];
  /** Absent on snapshots from older ws-server builds. */
  consumers?: ConsumerConnSnapshot[];
  ingestNodes: IngestNodeLive[];
  ingestFleet: { rxBps: number; txBps: number; nodeCount: number };
};

export type MonitorMessage = MonitorEnvelope | MonitorSnapshot | MonitorNodeBandwidth;

function isSnapshot(msg: MonitorMessage): msg is MonitorSnapshot {
  return msg.kind === "snapshot";
}

const MAX_EVENTS = 5000;
const RECONNECT_DELAY_MS = 3000;

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useMonitorWs(wsUrl: string | null, monitorSecret: string | null) {
  const [events, setEvents] = useState<MonitorEnvelope[]>([]);
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [eventsPerSec, setEventsPerSec] = useState(0);

  const pausedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventCountRef = useRef(0);

  const clearEvents = useCallback(() => setEvents([]), []);

  const setPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setEventsPerSec(eventCountRef.current);
      eventCountRef.current = 0;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!wsUrl || !monitorSecret) return;

    let disposed = false;

    function connect() {
      if (disposed) return;
      setStatus("connecting");

      const url = `${wsUrl}/ws?role=monitor&token=${encodeURIComponent(monitorSecret!)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
      };

      ws.onmessage = (e) => {
        try {
          const msg: MonitorMessage = JSON.parse(e.data as string);

          if (isSnapshot(msg)) {
            setSnapshot(msg);
            return;
          }

          // Per-node bandwidth ticks arrive every ~10s per node — routing them
          // into the event buffer would flood the live feed. The /ingest live
          // panel consumes these via its own dedicated hook instead.
          if (msg.kind === "node_bandwidth") return;

          eventCountRef.current++;

          if (pausedRef.current) return;

          setEvents((prev) => {
            const next = [msg, ...prev];
            return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
          });
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Don't resurrect the socket after teardown — otherwise every unmount
        // or wsUrl/secret change leaks a detached reconnect loop.
        if (disposed) return;
        setStatus("disconnected");
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        // Drop handlers first so the pending close can't schedule a reconnect.
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
        ws.close();
      }
    };
  }, [wsUrl, monitorSecret]);

  return { events, snapshot, status, eventsPerSec, clearEvents, setPaused };
}
