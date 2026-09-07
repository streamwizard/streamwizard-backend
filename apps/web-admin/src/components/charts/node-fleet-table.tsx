"use client";

import useSWR from "swr";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { StatusIndicator, type IndicatorStatus } from "@/components/widgets/status-indicator";
import { fetcher } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import type { FleetNode } from "@/lib/node-fleet";

interface Props {
  initialData: FleetNode[];
  apiPath: string;
  title: string;
}

const HEALTH_DISPLAY: Record<FleetNode["health"], { status: IndicatorStatus; label: string }> = {
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
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

/** Every REGISTERED node with its live /health result and last metric write —
 * a node that exists in the DB but is dead shows up here immediately. */
export function NodeFleetTable({ initialData, apiPath, title }: Props) {
  const { interval } = useRefreshInterval();
  const { data: raw } = useSWR<{ fleet: FleetNode[] }>(apiPath, fetcher, {
    fallbackData: { fleet: initialData },
    refreshInterval: interval,
  });

  const rows = raw?.fleet ?? initialData;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Health</TableHead>
                <TableHead>Node</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead>Registry</TableHead>
                <TableHead className="text-right">Last metric</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                        {node.health === "unreachable" && node.healthDetail && (
                          <div className="mt-0.5 text-xs text-muted-foreground">{node.healthDetail}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{node.name}</div>
                        <code className="font-mono text-xs text-muted-foreground">{node.address ?? "no address"}</code>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {node.health === "healthy" && node.healthLatencyMs !== null ? `${node.healthLatencyMs} ms` : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={node.status === "linked" ? "outline" : "secondary"}>{node.status}</Badge>
                          {node.maintenance && <Badge variant="secondary">maintenance</Badge>}
                        </div>
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
