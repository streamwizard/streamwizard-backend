"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { WsConnectionDurationPoint } from "@repo/metrics";
import {
  AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  ChartBody,
  LEGEND_WRAPPER_STYLE,
  rowsByTime,
  useMetricsPoll,
} from "./chart-kit";

interface Props {
  initialData: WsConnectionDurationPoint[];
}

const ROLE_COLORS: Record<string, string> = {
  publisher: "var(--chart-1)",
  subscriber: "var(--chart-2)",
  bot: "var(--chart-3)",
};

export function WsConnectionDurationChart({ initialData }: Props) {
  const { connectionDuration } = useMetricsPoll("/api/metrics/ws", {
    connectionDuration: initialData,
  });

  const durations = connectionDuration ?? initialData;
  // Convert ms → seconds for readability
  const chartData = rowsByTime(durations, (row, point) => {
    row[point.role] = Math.round(point.avgMs / 1000);
  });
  const roles = [...new Set(durations.map((d) => d.role))];

  if (durations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Duration</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          No closed connections in this time range
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Avg Connection Duration (seconds)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartBody isEmpty={false}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} unit="s" />
            <Tooltip
              formatter={(value) => [`${value}s`, ""]}
              contentStyle={CHART_TOOLTIP_STYLE}
            />
            <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} />
            {roles.map((role) => (
              <Line
                key={role}
                type="monotone"
                dataKey={role}
                stroke={ROLE_COLORS[role] ?? "var(--chart-4)"}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ChartBody>
      </CardContent>
    </Card>
  );
}
