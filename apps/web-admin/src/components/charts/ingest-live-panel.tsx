"use client";

import { ArrowDownToLine, ArrowUpFromLine, Radio, Server } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { StatCard } from "@/components/widgets/stat-card";
import { cn, formatBandwidth } from "@/lib/utils";
import { useBandwidthUnit } from "@/lib/bandwidth-unit-context";
import { useIngestLive } from "@/lib/ingest-live-context";
import type { LiveStatus } from "@/lib/ingest-live-ws";

// Realtime slice of the ingest page: fleet/per-node NIC bandwidth and
// per-stream transport health straight off the ws-server monitor socket
// (shared via IngestLiveProvider — see lib/ingest-live-context.tsx).
// Deliberately network-only — cpu/ram/disk stay on the InfluxDB panels below.

const STATUS_DISPLAY: Record<LiveStatus, { dot: string; label: string }> = {
  connected: { dot: "bg-emerald-500", label: "Live" },
  connecting: { dot: "bg-amber-500", label: "Connecting" },
  disconnected: { dot: "bg-red-500", label: "Disconnected" },
};

function WsStatusDot({ status }: { status: LiveStatus }) {
  const { dot, label } = STATUS_DISPLAY[status];
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {status === "connected" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/70 motion-reduce:hidden" />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dot)} />
      </span>
      <span className="font-medium text-foreground/80">{label}</span>
      <span aria-hidden="true">·</span>
      <span>websocket</span>
    </div>
  );
}

// Mirrors the loss colouring on the signals table so "something's hot" reads
// the same everywhere: amber past 1% loss, red past 5%.
function lossClass(pct: number | undefined): string {
  if (pct === undefined) return "text-muted-foreground";
  if (pct >= 5) return "text-red-600 dark:text-red-400";
  if (pct >= 1) return "text-amber-600 dark:text-amber-400";
  return "";
}

function num(v: number | undefined, suffix = "", digits = 0): string {
  return v === undefined ? "—" : `${v.toFixed(digits)}${suffix}`;
}

export function IngestLivePanel() {
  const { unit } = useBandwidthUnit();
  const { configured, status, nodes, fleet, streams } = useIngestLive();

  if (!configured) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Set <code className="font-mono text-xs">NEXT_PUBLIC_WS_SERVER_URL</code> and{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_MONITOR_SECRET</code> to enable realtime bandwidth.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Realtime network</h3>
        <WsStatusDot status={status} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Fleet In"
          value={formatBandwidth(fleet.rxBps, unit)}
          description="Host NIC receive, all nodes"
          icon={ArrowDownToLine}
        />
        <StatCard
          title="Fleet Out"
          value={formatBandwidth(fleet.txBps, unit)}
          description="Host NIC transmit, all nodes"
          icon={ArrowUpFromLine}
        />
        <StatCard
          title="Nodes Reporting"
          value={fleet.nodeCount}
          description="Pushed bandwidth in the last 30s"
          icon={Server}
          tone={fleet.nodeCount === 0 ? "warning" : "positive"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Node Bandwidth</CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {nodes.length} node{nodes.length === 1 ? "" : "s"}
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Node</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableHead className="text-right">Tailscale In</TableHead>
                    <TableHead className="text-right">Tailscale Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        No nodes reporting yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    nodes.map((n) => (
                      <TableRow key={n.nodeId}>
                        <TableCell className="font-mono text-xs">{n.nodeId}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBandwidth(n.rxBps, unit)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBandwidth(n.txBps, unit)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatBandwidth(n.tsRxBps, unit)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatBandwidth(n.tsTxBps, unit)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Live Streams</CardTitle>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              {streams.length} active
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stream</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Node</TableHead>
                    <TableHead className="text-right">Bitrate</TableHead>
                    <TableHead className="text-right">RTT</TableHead>
                    <TableHead className="text-right">Loss</TableHead>
                    <TableHead className="text-right">Buffer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {streams.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                        No active streams.
                      </TableCell>
                    </TableRow>
                  ) : (
                    streams.map(({ stats, roomId }) => (
                      <TableRow key={stats.session_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[10px] uppercase">
                              {stats.protocol}
                            </Badge>
                            <span className="text-xs">{stats.label ?? stats.session_id.slice(0, 8)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{roomId}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{stats.node_id ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(stats.kbps, " kbps")}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(stats.rtt_ms, " ms", 1)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", lossClass(stats.loss_pct))}>
                          {num(stats.loss_pct, "%", 2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{num(stats.ms_rcv_buf, " ms")}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
