"use client";

import { useEffect, useRef, useState } from "react";
import type { IngestStatsPayload } from "@repo/types";
import { supabase } from "@repo/supabase/next/client";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { env } from "@/lib/env";
import { useSession } from "@/providers/session-provider";

// No update for this long means the stream has likely ended — the media plane
// reports roughly every 2s while a session is active.
const STALE_MS = 6_000;

type ConnStatus = "connecting" | "connected" | "disconnected";

function qualityBadge(stats: IngestStatsPayload): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (stats.protocol === "rtmp") return { label: "live", variant: "default" };
  const loss = stats.pkt_recv_loss ?? 0;
  const rtt = stats.rtt_ms ?? 0;
  if (loss > 20 || rtt > 400) return { label: "poor connection", variant: "destructive" };
  if (loss > 0 || rtt > 150) return { label: "unstable", variant: "secondary" };
  return { label: "good", variant: "default" };
}

export function IngestLiveStats() {
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [stats, setStats] = useState<IngestStatsPayload | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useSession();

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token || cancelled) {
        return;
      }

      ws = new WebSocket(
        `${env.NEXT_PUBLIC_WS_SERVER_URL}/ws?role=subscriber&token=${encodeURIComponent(token)}&channels=streamwizard.ingest_stats`,
      );

      ws.onerror = (event) => {
        console.error("[IngestLiveStats] error", event);
      };

      ws.onopen = () => setStatus("connected");

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; payload: IngestStatsPayload };
          if (msg.type !== "streamwizard.ingest_stats") return;
          setStats(msg.payload);
          if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
          staleTimerRef.current = setTimeout(() => setStats(null), STALE_MS);
        } catch {
          console.error("[IngestLiveStats] error parsing message", event.data);
        }
      };

      ws.onclose = () => setStatus("disconnected");
      ws.onerror = () => ws?.close();
    })();

    return () => {
      cancelled = true;
      ws?.close();
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    };

  }, []);

  const badge = stats ? qualityBadge(stats) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Live ingest status
          {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
        </CardTitle>
        <CardDescription>
          {status === "connecting" && "Connecting…"}
          {status === "disconnected" && "Disconnected — refresh to retry."}
          {status === "connected" && !stats && "No active stream right now."}
          {status === "connected" && stats && `Receiving over ${stats.protocol.toUpperCase()}.`}
        </CardDescription>
      </CardHeader>
      {stats && (
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Bitrate" value={stats.kbps != null ? `${Math.round(stats.kbps)} kbps` : "—"} />
          {stats.protocol !== "rtmp" && (
            <>
              <Stat label="RTT" value={stats.rtt_ms != null ? `${stats.rtt_ms.toFixed(0)} ms` : "—"} />
              <Stat
                label="Packet loss"
                value={stats.pkt_recv_loss != null ? `${stats.pkt_recv_loss}/2s` : "—"}
              />
              <Stat
                label="Bandwidth est."
                value={stats.mbps_bandwidth != null ? `${stats.mbps_bandwidth.toFixed(1)} Mbps` : "—"}
              />
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
