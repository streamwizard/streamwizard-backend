"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IngestNodeLive, MonitorMessage } from "./monitor-ws";

// Dedicated live-data socket for the /ingest page. Deliberately NOT
// useMonitorWs: that hook buffers 5000 envelopes for the ws/live feed, while
// this page only needs "latest per node" bandwidth and "latest per session"
// stream stats — tiny bounded maps, no event history.

// Mirrors the widened IngestStatsPayload from @repo/types (web-admin
// redeclares WS shapes locally, same as monitor-ws.ts does).
export type LiveStreamStats = {
  session_id: string;
  protocol: "rtmp" | "srt" | "srtla";
  node_id?: string;
  stream_key_id?: string;
  label?: string;
  kbps?: number;
  mbps_recv_rate?: number;
  mbps_bandwidth?: number;
  rtt_ms?: number;
  pkt_recv_loss?: number;
  pkt_recv_drop?: number;
  pkt_recv_retrans?: number;
  ms_rcv_buf?: number;
  byte_recv_total?: number;
  loss_pct?: number;
  drop_pct?: number;
  retrans_pct?: number;
};

export type LiveStreamEntry = {
  stats: LiveStreamStats;
  /** Masked room id from the envelope — groups sessions per user. */
  roomId: string;
  receivedAt: number;
};

const RECONNECT_DELAY_MS = 3000;
// Nodes and streams both report every ~1s. Node eviction stays at 30s because
// the node's bot reconnect backoff caps at 30s — shorter would flap during
// reconnects; streams evict fast since a stopped stream never comes back
// under the same session_id.
const NODE_STALE_MS = 30_000;
const STREAM_STALE_MS = 10_000;
const EVICT_SWEEP_MS = 2_000;

export type LiveStatus = "connecting" | "connected" | "disconnected";

export function useIngestLiveWs(wsUrl: string | null, monitorSecret: string | null) {
  const [status, setStatus] = useState<LiveStatus>("disconnected");
  const [nodes, setNodes] = useState<Map<string, { entry: IngestNodeLive; receivedAt: number }>>(new Map());
  const [streams, setStreams] = useState<Map<string, LiveStreamEntry>>(new Map());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!wsUrl || !monitorSecret) return;

    let disposed = false;

    function connect() {
      if (disposed) return;
      setStatus("connecting");

      const url = `${wsUrl}/ws?role=monitor&token=${encodeURIComponent(monitorSecret!)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setStatus("connected");

      ws.onmessage = (e) => {
        try {
          const msg: MonitorMessage = JSON.parse(e.data as string);

          if (msg.kind === "node_bandwidth") {
            const p = msg.payload;
            setNodes((prev) => {
              const next = new Map(prev);
              next.set(p.node_id, {
                entry: {
                  nodeId: p.node_id,
                  ts: p.ts,
                  rxBps: p.rx_bytes_per_sec,
                  txBps: p.tx_bytes_per_sec,
                  tsRxBps: p.tailscale_rx_bytes_per_sec,
                  tsTxBps: p.tailscale_tx_bytes_per_sec,
                },
                receivedAt: Date.now(),
              });
              return next;
            });
            return;
          }

          if (msg.kind === "snapshot") {
            // Seed/refresh from the 5s snapshot so a late-joining page paints
            // immediately instead of waiting for each node's next tick.
            setNodes((prev) => {
              const next = new Map(prev);
              for (const n of msg.ingestNodes ?? []) {
                const existing = next.get(n.nodeId);
                // Live ticks are fresher than snapshots — never regress.
                if (!existing || existing.entry.ts <= n.ts) {
                  next.set(n.nodeId, { entry: n, receivedAt: Date.now() });
                }
              }
              return next;
            });
            return;
          }

          if (msg.kind === "message" && msg.eventType === "streamwizard.ingest_stats") {
            const stats = msg.payload as LiveStreamStats;
            if (!stats?.session_id) return;
            setStreams((prev) => {
              const next = new Map(prev);
              next.set(stats.session_id, { stats, roomId: msg.roomId, receivedAt: Date.now() });
              return next;
            });
          }
        } catch {
          // ignore malformed frames
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

      ws.onerror = () => ws.close();
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

  // Age out nodes/streams that stopped reporting so a dead node doesn't
  // freeze at its last reading.
  useEffect(() => {
    const sweep = setInterval(() => {
      const now = Date.now();
      setNodes((prev) => {
        if (![...prev.values()].some((v) => now - v.receivedAt > NODE_STALE_MS)) return prev;
        return new Map([...prev].filter(([, v]) => now - v.receivedAt <= NODE_STALE_MS));
      });
      setStreams((prev) => {
        if (![...prev.values()].some((v) => now - v.receivedAt > STREAM_STALE_MS)) return prev;
        return new Map([...prev].filter(([, v]) => now - v.receivedAt <= STREAM_STALE_MS));
      });
    }, EVICT_SWEEP_MS);
    return () => clearInterval(sweep);
  }, []);

  const nodeList = useMemo(
    () => [...nodes.values()].map((v) => v.entry).sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
    [nodes],
  );

  const fleet = useMemo(
    () => ({
      rxBps: nodeList.reduce((sum, n) => sum + n.rxBps, 0),
      txBps: nodeList.reduce((sum, n) => sum + n.txBps, 0),
      nodeCount: nodeList.length,
    }),
    [nodeList],
  );

  const streamList = useMemo(
    () => [...streams.values()].sort((a, b) => a.roomId.localeCompare(b.roomId) || a.stats.session_id.localeCompare(b.stats.session_id)),
    [streams],
  );

  return { status, nodes: nodeList, fleet, streams: streamList };
}
