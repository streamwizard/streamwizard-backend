"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PlatformPoint } from "@repo/metrics";
import { formatTime } from "@/lib/utils";
import {
  AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  ChartCard,
  useMetricsPoll,
} from "./chart-kit";

interface Props {
  title: string;
  /** Key into the /api/metrics/supabase response. */
  seriesKey:
    | "cpu"
    | "memory"
    | "disk"
    | "connections"
    | "cacheHit"
    | "meanQueryMs"
    | "queryRate"
    | "authApiMs";
  initialData: PlatformPoint[];
  unit?: string;
  /** Chart color CSS var index (1-5), maps to --chart-N. */
  color?: number;
  yMax?: number;
}

export function PlatformMetricChart({
  title,
  seriesKey,
  initialData,
  unit = "",
  color = 1,
  yMax,
}: Props) {
  const raw = useMetricsPoll<Record<string, PlatformPoint[]>>(
    "/api/metrics/supabase",
    { [seriesKey]: initialData },
  );

  const series = raw[seriesKey] ?? initialData;
  const chartData = series.map((p) => ({
    time: formatTime(p.time),
    value: p.value,
  }));
  const stroke = `var(--chart-${color})`;
  const gradientId = `gPlatform${seriesKey}`;

  return (
    <ChartCard title={title} isEmpty={chartData.length === 0}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={stroke} stopOpacity={0.3} />
            <stop offset="95%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="time"
          tick={AXIS_TICK}
          className="fill-muted-foreground"
        />
        <YAxis
          tick={AXIS_TICK}
          className="fill-muted-foreground"
          domain={yMax !== undefined ? [0, yMax] : undefined}
          tickFormatter={(v: number) => `${Math.round(v)}${unit}`}
        />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(value) => [`${Number(value).toFixed(1)}${unit}`, title]}
        />
        {/* An area series needs 2+ points to draw anything — show dots
            while the series is sparse (young bucket, wide windows). */}
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          fill={`url(#${gradientId})`}
          strokeWidth={2}
          dot={
            chartData.length < 10
              ? { r: 3, strokeWidth: 0, fill: stroke }
              : false
          }
        />
      </AreaChart>
    </ChartCard>
  );
}
