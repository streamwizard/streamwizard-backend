"use client";

import useSWR from "swr";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { fetcher } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useTimeRange } from "@/lib/time-range-context";
import type { HttpRouteStatPoint } from "@repo/metrics";

interface Props {
  initialData: HttpRouteStatPoint[];
}

export function HttpRouteTable({ initialData }: Props) {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { data: raw } = useSWR<{ routeStats: HttpRouteStatPoint[] }>(
    `/api/metrics/http?range=${range.fluxRange}&window=${range.window}`,
    fetcher,
    { fallbackData: { routeStats: initialData }, refreshInterval: interval }
  );

  const rows = (raw?.routeStats ?? initialData).slice(0, 20);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Routes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Method</TableHead>
              <TableHead>Route</TableHead>
              <TableHead className="text-right">Requests</TableHead>
              <TableHead className="text-right">Avg Latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No data yet
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {row.method}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs truncate max-w-[240px]">{row.route}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.requestCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(row.avgDurationMs)}ms</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
