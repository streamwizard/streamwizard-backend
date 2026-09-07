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
import type { WsConnectionPoint } from "@repo/metrics";
import {
  AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  ChartCard,
  LEGEND_WRAPPER_STYLE,
  rowsByTime,
  useMetricsPoll,
} from "./chart-kit";

interface Props {
  initialData: WsConnectionPoint[];
}

const ROLE_SERIES = [
  { role: "publisher", gradientId: "gPublisher", color: "var(--chart-1)" },
  { role: "subscriber", gradientId: "gSubscriber", color: "var(--chart-2)" },
  { role: "bot", gradientId: "gBot", color: "var(--chart-3)" },
] as const;

export function WsConnectionChart({ initialData }: Props) {
  const { connections } = useMetricsPoll("/api/metrics/ws", {
    connections: initialData,
  });

  // Only "open" events — this chart counts connections made, not churn.
  const opens = (connections ?? initialData).filter(
    (point) => point.event === "open",
  );
  const chartData = rowsByTime(opens, (row, point) => {
    row[point.role] =
      ((row[point.role] as number | undefined) ?? 0) + point.count;
  });

  return (
    <ChartCard
      title="Connections by Role (opens)"
      isEmpty={chartData.length === 0}
    >
      <AreaChart data={chartData}>
        <defs>
          {ROLE_SERIES.map(({ gradientId, color }) => (
            <linearGradient
              key={gradientId}
              id={gradientId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="time"
          tick={AXIS_TICK}
          className="fill-muted-foreground"
        />
        <YAxis
          allowDecimals={false}
          tick={AXIS_TICK}
          className="fill-muted-foreground"
        />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} />
        {ROLE_SERIES.map(({ role, gradientId, color }) => (
          <Area
            key={role}
            type="monotone"
            dataKey={role}
            stroke={color}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ChartCard>
  );
}
