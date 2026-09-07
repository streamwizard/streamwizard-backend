"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricsSample } from "@/hooks/use-node-metrics-stream";

function formatTime(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface SeriesDef {
  dataKey: string;
  label: string;
  color: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="space-y-1 rounded-lg border bg-popover p-3 text-sm shadow-md">
      <p className="text-muted-foreground">{formatTime(label)}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value?.toLocaleString()}
          {unit ?? ""}
        </p>
      ))}
    </div>
  );
}

function MiniLineChart({
  data,
  series,
  unit,
  domain,
}: {
  data: Record<string, number | null>[];
  series: SeriesDef[];
  unit?: string;
  domain?: [number, number | "auto"];
}) {
  return (
    <div className="h-[140px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTime}
            tick={{ fontSize: 11 }}
            minTickGap={40}
          />
          <YAxis domain={domain ?? [0, "auto"]} tick={{ fontSize: 11 }} width={36} />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.label}
              stroke={s.color}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const CHART_COLORS = {
  gpuUtil: "var(--chart-1)",
  gpuTemp: "var(--chart-2)",
  vramUsed: "var(--chart-3)",
  cpuPct: "var(--chart-4)",
  ramUsed: "var(--chart-5)",
};

export function HostMetricsCharts({ samples }: { samples: MetricsSample[] }) {
  const latestSample = samples[samples.length - 1];
  const vramTotal = latestSample?.host.vram_total_mb;
  const ramTotal = latestSample?.host.ram_total_mb;

  const gpuUtilData = samples.map((s) => ({ t: s.timestamp, gpuUtil: s.host.gpu_util_pct }));
  const gpuTempData = samples.map((s) => ({ t: s.timestamp, gpuTemp: s.host.gpu_temp_c }));
  const vramData = samples.map((s) => ({ t: s.timestamp, vramUsed: s.host.vram_used_mb }));
  const cpuData = samples.map((s) => ({ t: s.timestamp, cpuPct: s.host.cpu_pct }));
  const ramData = samples.map((s) => ({ t: s.timestamp, ramUsed: s.host.ram_used_mb }));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ChartCard title="GPU utilization">
        <MiniLineChart
          data={gpuUtilData}
          series={[{ dataKey: "gpuUtil", label: "GPU util", color: CHART_COLORS.gpuUtil }]}
          unit="%"
          domain={[0, 100]}
        />
      </ChartCard>
      <ChartCard title="GPU temperature">
        <MiniLineChart
          data={gpuTempData}
          series={[{ dataKey: "gpuTemp", label: "GPU temp", color: CHART_COLORS.gpuTemp }]}
          unit="°C"
        />
      </ChartCard>
      <ChartCard title="VRAM used">
        <MiniLineChart
          data={vramData}
          series={[{ dataKey: "vramUsed", label: "VRAM used", color: CHART_COLORS.vramUsed }]}
          unit=" MB"
          domain={[0, vramTotal ?? "auto"]}
        />
      </ChartCard>
      <ChartCard title="CPU">
        <MiniLineChart
          data={cpuData}
          series={[{ dataKey: "cpuPct", label: "CPU %", color: CHART_COLORS.cpuPct }]}
          unit="%"
          domain={[0, 100]}
        />
      </ChartCard>
      <ChartCard title="RAM used">
        <MiniLineChart
          data={ramData}
          series={[{ dataKey: "ramUsed", label: "RAM used", color: CHART_COLORS.ramUsed }]}
          unit=" MB"
          domain={[0, ramTotal ?? "auto"]}
        />
      </ChartCard>
    </div>
  );
}

export function ContainerMetricsCharts({
  samples,
  instanceId,
  vramMaxMb,
}: {
  samples: MetricsSample[];
  instanceId: string;
  vramMaxMb?: number;
}) {
  const latestContainerSample = [...samples].reverse().find((s) => s.containers[instanceId]);
  const ramTotal = latestContainerSample?.containers[instanceId]?.ram_limit_mb;

  const cpuData = samples.map((s) => ({ t: s.timestamp, cpuPct: s.containers[instanceId]?.cpu_pct ?? null }));
  const ramData = samples.map((s) => ({ t: s.timestamp, ramUsed: s.containers[instanceId]?.ram_used_mb ?? null }));
  const vramData = samples.map((s) => ({ t: s.timestamp, vramUsed: s.containers[instanceId]?.vram_used_mb ?? null }));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <ChartCard title="CPU">
        <MiniLineChart data={cpuData} series={[{ dataKey: "cpuPct", label: "CPU %", color: CHART_COLORS.cpuPct }]} unit="%" domain={[0, 100]} />
      </ChartCard>
      <ChartCard title="RAM">
        <MiniLineChart
          data={ramData}
          series={[{ dataKey: "ramUsed", label: "RAM used", color: CHART_COLORS.ramUsed }]}
          unit=" MB"
          domain={[0, ramTotal ?? "auto"]}
        />
      </ChartCard>
      <ChartCard title="VRAM">
        <MiniLineChart
          data={vramData}
          series={[{ dataKey: "vramUsed", label: "VRAM used", color: CHART_COLORS.vramUsed }]}
          unit=" MB"
          domain={[0, vramMaxMb ?? "auto"]}
        />
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="mb-1 text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}
