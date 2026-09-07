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
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { CheckCircle2 } from "lucide-react";
import type { WsMessageDropPoint } from "@repo/metrics";
import {
  AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  ChartBody,
  LEGEND_WRAPPER_STYLE,
  chartColor,
  stackByTime,
  useMetricsPoll,
} from "./chart-kit";

interface Props {
  initialData: WsMessageDropPoint[];
}

const REASON_COLORS: Record<string, string> = {
  room_not_found: "var(--chart-1)",
  malformed_json: "var(--chart-3)",
};

const seriesKeyOf = (point: Pick<WsMessageDropPoint, "role" | "reason">) =>
  `${point.role}:${point.reason}`;

export function WsMessageDropChart({ initialData }: Props) {
  const { droppedMessages } = useMetricsPoll("/api/metrics/ws", {
    droppedMessages: initialData,
  });

  const drops = droppedMessages ?? initialData;
  const chartData = stackByTime(drops, seriesKeyOf);
  const totalDrops = drops.reduce((acc, d) => acc + d.count, 0);
  const seriesKeys = [...new Set(drops.map(seriesKeyOf))];

  if (totalDrops === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dropped Messages</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 py-8 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">
            No dropped messages in this time range
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Dropped Messages
          <span className="text-sm font-normal text-destructive">
            ({totalDrops} total)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartBody isEmpty={chartData.length === 0}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={AXIS_TICK} />
            <YAxis allowDecimals={false} tick={AXIS_TICK} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} />
            {seriesKeys.map((key, i) => {
              const reason = key.split(":")[1] ?? key;
              return (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="a"
                  fill={REASON_COLORS[reason] ?? chartColor(i)}
                />
              );
            })}
          </BarChart>
        </ChartBody>
      </CardContent>
    </Card>
  );
}
