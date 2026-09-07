"use client";

import type { ReactElement } from "react";
import useSWR from "swr";
import { ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { ChartEmptyState } from "@/components/widgets/chart-empty-state";
import { fetcher, formatTime } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useTimeRange } from "@/lib/time-range-context";

/**
 * The bits every monitor chart repeated verbatim: the palette, the tooltip
 * chrome, the axis tick sizing, the card + empty-state + responsive-container
 * shell, and the SWR poll bound to the page's range and refresh interval.
 */

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]!;
}

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  fontSize: "12px",
} as const;

export const AXIS_TICK = { fontSize: 11 } as const;
export const LEGEND_WRAPPER_STYLE = { fontSize: "12px" } as const;

export type ChartRow = { time: string; [key: string]: number | string };

/**
 * Buckets time-series points into one row per timestamp, summing `count` into
 * a column per series — the shape every stacked bar/area chart here needs.
 * Rows come back sorted oldest-first with `time` already display-formatted.
 */
export function stackByTime<T extends { time: string; count: number }>(
  points: T[],
  seriesKey: (point: T) => string,
): ChartRow[] {
  return rowsByTime(points, (row, point) => {
    const key = seriesKey(point);
    row[key] = ((row[key] as number | undefined) ?? 0) + point.count;
  });
}

/** stackByTime's general form: the caller writes whatever columns it wants per point. */
export function rowsByTime<T extends { time: string }>(
  points: T[],
  fill: (row: ChartRow, point: T) => void,
): ChartRow[] {
  const rows = new Map<string, ChartRow>();

  for (const point of points) {
    const row: ChartRow = rows.get(point.time) ?? { time: point.time };
    fill(row, point);
    rows.set(point.time, row);
  }

  return Array.from(rows.values())
    .sort(
      (a, b) =>
        new Date(a.time as string).getTime() -
        new Date(b.time as string).getTime(),
    )
    .map((row) => ({ ...row, time: formatTime(row.time as string) }));
}

/** Empty state or responsive container — the inside of a chart card. */
export function ChartBody({
  isEmpty,
  height = 240,
  children,
}: {
  isEmpty: boolean;
  height?: number;
  children: ReactElement;
}) {
  if (isEmpty) return <ChartEmptyState height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  );
}

/** Titled card wrapping a chart. Use ChartBody directly when the header needs extras. */
export function ChartCard({
  title,
  isEmpty,
  height = 240,
  children,
}: {
  title: string;
  isEmpty: boolean;
  height?: number;
  children: ReactElement;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartBody isEmpty={isEmpty} height={height}>
          {children}
        </ChartBody>
      </CardContent>
    </Card>
  );
}

/**
 * Polls a metrics endpoint on the page's refresh interval, scoped to the
 * page's selected range. `fallbackData` is the server-rendered payload, so the
 * chart never flashes empty on mount.
 */
export function useMetricsPoll<T>(endpoint: string, fallbackData: T): T {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { data } = useSWR<T>(
    `${endpoint}?range=${range.fluxRange}&window=${range.window}`,
    fetcher,
    {
      fallbackData,
      refreshInterval: interval,
    },
  );
  return data ?? fallbackData;
}
