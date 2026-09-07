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
import type { WsAuthFailurePoint } from "@repo/metrics";
import {
  AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  ChartBody,
  LEGEND_WRAPPER_STYLE,
  stackByTime,
  useMetricsPoll,
} from "./chart-kit";

interface Props {
  initialData: WsAuthFailurePoint[];
}

const REASONS = [
  "rate_limited",
  "invalid_token",
  "missing_token",
  "invalid_role",
  "invalid_bot_key",
  "upgrade_failed",
];
const COLORS: Record<string, string> = {
  rate_limited: "var(--chart-5)",
  invalid_token: "var(--chart-1)",
  missing_token: "var(--chart-3)",
  invalid_role: "var(--chart-4)",
  invalid_bot_key: "var(--chart-2)",
  upgrade_failed: "var(--destructive)",
};

export function WsAuthFailureChart({ initialData }: Props) {
  const { authFailures } = useMetricsPoll("/api/metrics/ws", {
    authFailures: initialData,
  });

  const failures = authFailures ?? initialData;
  const chartData = stackByTime(failures, (point) => point.reason);
  const totalFailures = failures.reduce((acc, f) => acc + f.count, 0);
  const activeReasons = REASONS.filter((r) =>
    failures.some((f) => f.reason === r),
  );

  if (totalFailures === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auth Failures</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 py-8 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">
            No auth failures in this time range
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Auth Failures
          <span className="text-sm font-normal text-destructive">
            ({totalFailures} total)
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
            {activeReasons.map((reason) => (
              <Bar
                key={reason}
                dataKey={reason}
                stackId="a"
                fill={COLORS[reason] ?? "var(--chart-1)"}
              />
            ))}
          </BarChart>
        </ChartBody>
      </CardContent>
    </Card>
  );
}
