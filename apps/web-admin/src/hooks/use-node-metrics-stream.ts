"use client";

import { useEffect, useState } from "react";
import { mintWsUrl } from "@repo/obs-web";

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const MAX_BUFFER_SIZE = 100; // ~5 min at the server's 3000ms push interval
// Fallback watchdog window until the server's session_welcome tells us its
// keepalive_timeout. If no frame (notification or keepalive) arrives within the
// window, the socket is treated as dead and we reconnect.
const DEFAULT_KEEPALIVE_TIMEOUT_MS = 15000;

export interface HostMetrics {
  gpu_name: string;
  vram_used_mb: number;
  vram_total_mb: number;
  gpu_util_pct: number;
  mem_controller_util_pct: number;
  nvenc_avg_fps: number;
  gpu_temp_c: number;
  cpu_pct: number;
  ram_used_mb: number;
  ram_total_mb: number;
}

export interface ContainerMetrics {
  cpu_pct: number;
  ram_used_mb: number;
  ram_limit_mb: number;
  vram_used_mb: number;
}

export interface MetricsMessage {
  timestamp: string;
  host: HostMetrics;
  containers: Record<string, ContainerMetrics>;
}

export interface MetricsSample {
  timestamp: number;
  host: HostMetrics;
  containers: Record<string, ContainerMetrics>;
}

export type ConnectionStatus = "not_linked" | "connecting" | "live" | "unreachable";

// Twitch EventSub-style session envelope sent by the node.
type ServerMessage =
  | { type: "session_welcome"; session: { id: string; keepalive_timeout_seconds: number } }
  | { type: "session_keepalive" }
  | { type: "session_reconnect"; session: { reconnect_url: string } }
  | { type: "notification"; payload: MetricsMessage };

// Connects straight to obs-instance-manager's /admin/metrics/stream from the
// browser. Auth is a short-lived single-use ws-ticket minted over an
// authenticated POST (the admin JWT stays in the Authorization header, never on
// the socket) -- see lib/ws-ticket.ts. The stream is wrapped in a Twitch-style
// session lifecycle: session_welcome, then notification frames, with
// session_keepalive heartbeats and session_reconnect on node drain.
export function useNodeMetricsStream(nodeId: string, nodeStatus: string, apiUrl: string | null) {
  // "not_linked" is derived at render time rather than set from the effect,
  // since it's purely a function of props -- only "connecting"/"live"/"unreachable"
  // are genuine connection state set from the WebSocket lifecycle below.
  const [connectionState, setStatus] = useState<Exclude<ConnectionStatus, "not_linked">>("connecting");
  const [latest, setLatest] = useState<MetricsMessage | null>(null);
  const [buffer, setBuffer] = useState<MetricsSample[]>([]);
  const isLinked = nodeStatus === "linked" && !!apiUrl;
  const status: ConnectionStatus = isLinked ? connectionState : "not_linked";

  useEffect(() => {
    if (!isLinked || !apiUrl) return;

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    let keepaliveTimeoutMs = DEFAULT_KEEPALIVE_TIMEOUT_MS;
    let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    // Accumulated locally (not read from React state) so switching nodeId
    // starts a fresh buffer without an unconditional setState at the top of
    // the effect -- only the message handler (an event callback) ever calls
    // setBuffer.
    let sampleBuffer: MetricsSample[] = [];

    // Reset on every inbound frame. If it fires, the connection is dead (or the
    // server stalled) -- close to trigger a reconnect, the same way Twitch
    // EventSub clients treat a missed keepalive.
    const armWatchdog = () => {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(() => {
        ws?.close();
      }, keepaliveTimeoutMs);
    };

    const handleMetrics = (message: MetricsMessage) => {
      setLatest(message);
      setStatus("live");
      sampleBuffer = [...sampleBuffer, { timestamp: Date.now(), host: message.host, containers: message.containers }];
      if (sampleBuffer.length > MAX_BUFFER_SIZE) {
        sampleBuffer = sampleBuffer.slice(sampleBuffer.length - MAX_BUFFER_SIZE);
      }
      setBuffer(sampleBuffer);
    };

    const dial = async () => {
      if (cancelled) return;
      setStatus("connecting");

      let wsUrl: string;
      try {
        wsUrl = await mintWsUrl(apiUrl, {
          ticketPath: "/admin/ws-ticket",
          wsPath: "/admin/metrics/stream",
          scope: "metrics",
        });
      } catch {
        if (!cancelled) scheduleReconnect();
        return;
      }
      if (cancelled) return;

      const socket = new WebSocket(wsUrl);
      ws = socket;

      socket.addEventListener("open", () => {
        reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
        // Arm with the default until session_welcome refines the timeout.
        armWatchdog();
      });

      socket.addEventListener("message", (event) => {
        // Any frame proves the connection is alive.
        armWatchdog();

        let message: ServerMessage;
        try {
          message = JSON.parse(event.data) as ServerMessage;
        } catch {
          return; // ignore malformed payloads, keep last-known-good metrics
        }

        switch (message.type) {
          case "session_welcome":
            keepaliveTimeoutMs = (message.session.keepalive_timeout_seconds + 5) * 1000;
            armWatchdog();
            break;
          case "session_keepalive":
            break; // watchdog already reset above
          case "session_reconnect":
            // Node is draining -- reconnect promptly (fresh ticket) instead of
            // waiting out the backoff. Closing triggers the close handler.
            reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
            socket.close();
            break;
          case "notification":
            handleMetrics(message.payload);
            break;
        }
      });

      socket.addEventListener("close", () => {
        ws = null;
        if (watchdogTimer) clearTimeout(watchdogTimer);
        if (!cancelled) scheduleReconnect();
      });

      socket.addEventListener("error", () => {
        socket.close();
      });
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      setStatus("unreachable");
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        dial();
      }, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    };

    dial();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (watchdogTimer) clearTimeout(watchdogTimer);
      ws?.close();
    };
  }, [nodeId, isLinked, apiUrl]);

  return { status, latest, buffer };
}
