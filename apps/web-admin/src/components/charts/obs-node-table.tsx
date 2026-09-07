"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { fetcher, formatBandwidth } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useBandwidthUnit } from "@/lib/bandwidth-unit-context";
import type { ObsNodeSnapshot } from "@repo/metrics";

interface Props {
  initialData: ObsNodeSnapshot[];
}

// One row per OBS node, latest reading — capacity headroom at a glance
// (running instances vs max, VRAM used vs total).
export function ObsNodeTable({ initialData }: Props) {
  const { interval } = useRefreshInterval();
  const { unit } = useBandwidthUnit();
  const { data: raw } = useSWR<{ nodeSnapshot: ObsNodeSnapshot[] }>("/api/metrics/obs", fetcher, {
    fallbackData: { nodeSnapshot: initialData },
    refreshInterval: interval,
  });

  const rows = raw?.nodeSnapshot ?? initialData;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nodes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Node</TableHead>
              <TableHead className="text-right">CPU</TableHead>
              <TableHead className="text-right">RAM</TableHead>
              <TableHead className="text-right">GPU</TableHead>
              <TableHead className="text-right">Encoder</TableHead>
              <TableHead className="text-right">Power</TableHead>
              <TableHead className="text-right">VRAM</TableHead>
              <TableHead className="text-right">NVENC</TableHead>
              <TableHead className="text-right">Instances</TableHead>
              <TableHead className="text-right">Bandwidth (in/out)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No nodes reporting
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.nodeId}>
                  <TableCell className="font-mono text-xs">{row.nodeId}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.cpuPct.toFixed(0)}%</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.ramUsedMb.toFixed(0)} / {row.ramTotalMb.toFixed(0)} MB
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.gpuUtilPct.toFixed(0)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{row.encoderUtilPct.toFixed(0)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{row.powerDrawW.toFixed(0)} W</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.vramUsedMb.toFixed(0)} / {row.vramTotalMb.toFixed(0)} MB
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.nvencSessions} @ {row.nvencAvgFps.toFixed(0)} fps
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.runningInstanceCount} / {row.maxInstances}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                    {formatBandwidth(row.rxBytesPerSec, unit)} / {formatBandwidth(row.txBytesPerSec, unit)}
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
