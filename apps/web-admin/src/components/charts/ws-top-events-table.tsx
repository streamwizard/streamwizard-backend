"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { fetcher } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useTimeRange } from "@/lib/time-range-context";
import type { WsTopMessageTypePoint } from "@repo/metrics";

interface Props {
  initialData: WsTopMessageTypePoint[];
}

export function WsTopEventsTable({ initialData }: Props) {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { data: raw } = useSWR<{ topMessageTypes: WsTopMessageTypePoint[] }>(
    `/api/metrics/ws?range=${range.fluxRange}&window=${range.window}`,
    fetcher,
    { fallbackData: { topMessageTypes: initialData }, refreshInterval: interval }
  );

  const rows = raw?.topMessageTypes ?? initialData;
  const total = rows.reduce((acc, r) => acc + r.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Event Types</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No messages in this time range
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={row.messageType}>
                  <TableCell className="text-muted-foreground text-xs w-8">{i + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{row.messageType}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.count.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {total > 0 ? `${((row.count / total) * 100).toFixed(1)}%` : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
