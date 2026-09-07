"use client";

import useSWR from "swr";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { StatusIndicator, type IndicatorStatus } from "@/components/widgets/status-indicator";
import { fetcher, formatBandwidth } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useBandwidthUnit } from "@/lib/bandwidth-unit-context";
import { useIngestLive } from "@/lib/ingest-live-context";
import type { IngestNode } from "@/lib/ingest-nodes";

interface Props {
  initialData: IngestNode[];
  title: string;
}

const HEALTH_DISPLAY: Record<IngestNode["health"], { status: IndicatorStatus; label: string }> = {
  healthy: { status: "ok", label: "Healthy" },
  unreachable: { status: "crit", label: "Unreachable" },
  unknown: { status: "muted", label: "No health URL" },
};

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 90) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

// Amber past 75%, red past 90% — mirrors the loss colouring on the signals
// table so "something's hot" reads the same everywhere.
function pctClass(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 90) return "text-red-600 dark:text-red-400";
  if (pct >= 75) return "text-amber-600 dark:text-amber-400";
  return "";
}

function pct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(0)}%`;
}

function ram(usedMb: number | null, totalMb: number | null): string {
  if (usedMb === null || !totalMb) return "—";
  return `${(usedMb / 1024).toFixed(1)} / ${(totalMb / 1024).toFixed(1)} GB`;
}

/** One row per registered ingest node: live health + latest host snapshot in a
 *  single scannable table. */
export function IngestNodeTable({ initialData, title }: Props) {
  const { interval } = useRefreshInterval();
  const { unit } = useBandwidthUnit();
  const { nodes: liveNodes } = useIngestLive();
  const { data: raw } = useSWR<{ ingestNodes: IngestNode[] }>("/api/metrics/ingest", fetcher, {
    fallbackData: { ingestNodes: initialData },
    refreshInterval: interval,
  });

  // Network column prefers the 1s WebSocket reading over the polled InfluxDB
  // snapshot (registry node id == WS node_id == the InfluxDB node_id tag).
  // Nodes without a live entry — WS down, or an old image — keep the polled
  // value, so the column degrades to exactly what it showed before.
  const liveById = new Map(liveNodes.map((n) => [n.nodeId, n]));
  const rows = (raw?.ingestNodes ?? initialData).map((node) => {
    const live = liveById.get(node.id);
    return live ? { ...node, rxBytesPerSec: live.rxBps, txBytesPerSec: live.txBps } : node;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className="text-xs text-muted-foreground tabular-nums">
          {rows.length} node{rows.length === 1 ? "" : "s"}
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Health</TableHead>
                <TableHead>Node</TableHead>
                <TableHead className="text-right">CPU</TableHead>
                <TableHead className="text-right">RAM</TableHead>
                <TableHead className="text-right">Disk</TableHead>
                <TableHead className="text-right">Load</TableHead>
                <TableHead className="text-right">Network</TableHead>
                <TableHead className="text-right">Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No nodes registered
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((node) => {
                  const health = HEALTH_DISPLAY[node.health];
                  return (
                    <TableRow key={node.id}>
                      <TableCell>
                        <StatusIndicator status={health.status} label={health.label} />
                        {node.maintenance && (
                          <Badge variant="secondary" className="mt-1 text-[10px]">
                            maintenance
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{node.name}</div>
                        <code className="font-mono text-xs text-muted-foreground">{node.address ?? "no address"}</code>
                      </TableCell>
                      <TableCell className={`text-right tabular-nums text-sm ${pctClass(node.cpuPct)}`}>
                        {pct(node.cpuPct)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {ram(node.ramUsedMb, node.ramTotalMb)}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums text-sm ${pctClass(node.diskUsedPct)}`}>
                        {pct(node.diskUsedPct)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {node.loadAvg1 === null ? "—" : node.loadAvg1.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {node.rxBytesPerSec === null ? (
                          "—"
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <span className="inline-flex items-center gap-0.5">
                              <ArrowDown className="h-3 w-3 text-emerald-500" aria-hidden />
                              {formatBandwidth(node.rxBytesPerSec, unit)}
                            </span>
                            <span className="inline-flex items-center gap-0.5">
                              <ArrowUp className="h-3 w-3 text-sky-500" aria-hidden />
                              {formatBandwidth(node.txBytesPerSec ?? 0, unit)}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {relativeTime(node.lastMetricAt)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
