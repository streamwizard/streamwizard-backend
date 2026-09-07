"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WsMessagePoint } from "@repo/metrics";
import {
  AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  ChartCard,
  LEGEND_WRAPPER_STYLE,
  chartColor,
  stackByTime,
  useMetricsPoll,
} from "./chart-kit";

interface Props {
  initialData: WsMessagePoint[];
}

const seriesKeyOf = (point: Pick<WsMessagePoint, "role" | "messageType">) =>
  `${point.role}:${point.messageType}`;

export function WsMessageChart({ initialData }: Props) {
  const { messages } = useMetricsPoll("/api/metrics/ws", {
    messages: initialData,
  });

  const points = messages ?? initialData;
  const chartData = stackByTime(points, seriesKeyOf);
  const seriesKeys = [...new Set(points.map(seriesKeyOf))];

  return (
    <ChartCard title="Messages by Role & Type" isEmpty={chartData.length === 0}>
      <BarChart data={chartData}>
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
        {seriesKeys.map((key, i) => (
          <Bar key={key} dataKey={key} stackId="a" fill={chartColor(i)} />
        ))}
      </BarChart>
    </ChartCard>
  );
}
