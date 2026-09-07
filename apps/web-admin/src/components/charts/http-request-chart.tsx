"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HttpRequestPoint } from "@repo/metrics";
import {
  AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  ChartCard,
  LEGEND_WRAPPER_STYLE,
  rowsByTime,
  useMetricsPoll,
} from "./chart-kit";

interface Props {
  initialData: HttpRequestPoint[];
}

export function HttpRequestChart({ initialData }: Props) {
  const { requests } = useMetricsPoll("/api/metrics/http", {
    requests: initialData,
  });

  const chartData = rowsByTime(requests ?? initialData, (row, point) => {
    row["avg_ms"] = Math.round(
      (Number(row["avg_ms"] ?? 0) + point.durationMs) / 2,
    );
    row[`${point.status}`] = Number(row[`${point.status}`] ?? 0) + 1;
  });

  return (
    <ChartCard title="Avg Response Time (ms)" isEmpty={chartData.length === 0}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="gAvgMs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="time"
          tick={AXIS_TICK}
          className="fill-muted-foreground"
        />
        <YAxis tick={AXIS_TICK} className="fill-muted-foreground" unit="ms" />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} />
        <Area
          type="monotone"
          dataKey="avg_ms"
          name="Avg Latency"
          stroke="var(--chart-2)"
          fill="url(#gAvgMs)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartCard>
  );
}
