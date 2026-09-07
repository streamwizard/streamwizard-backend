"use client";

import { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Cpu, MemoryStick, MonitorPlay, Gauge } from "lucide-react";
import type { ObsStats } from "@repo/obs-web";

interface Sample {
  t: string;
  cpu: number;
  ram: number;
  fps: number;
  frameTime: number;
}

const MAX_SAMPLES = 40;

function formatTime(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center gap-4">
      <div className={`rounded-md p-2 ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function MiniChart({ data, dataKey, color, unit }: { data: Sample[]; dataKey: keyof Sample; color: string; unit: string }) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="t" hide />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            fontSize: "12px",
          }}
          formatter={(v) => [`${Number(v).toFixed(1)}${unit}`, dataKey.toString().toUpperCase()]}
          labelFormatter={() => ""}
        />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface Props {
  obsStats: ObsStats | null;
}

export function ObsResourceGraphs({ obsStats }: Props) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const prevStats = useRef<ObsStats | null>(null);

  useEffect(() => {
    if (!obsStats) return;
    if (prevStats.current === obsStats) return;
    prevStats.current = obsStats;

    setSamples((prev) => {
      const next: Sample = {
        t: formatTime(),
        cpu: parseFloat(obsStats.cpuUsage.toFixed(1)),
        ram: parseFloat(obsStats.memoryUsage.toFixed(0)),
        fps: parseFloat(obsStats.activeFps.toFixed(1)),
        frameTime: parseFloat(obsStats.averageFrameRenderTime.toFixed(2)),
      };
      const updated = [...prev, next];
      return updated.length > MAX_SAMPLES ? updated.slice(updated.length - MAX_SAMPLES) : updated;
    });
  }, [obsStats]);

  if (!obsStats) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Not connected to OBS — connect to see live metrics.
      </p>
    );
  }

  const latest = samples[samples.length - 1] ?? {
    cpu: obsStats.cpuUsage,
    ram: obsStats.memoryUsage,
    fps: obsStats.activeFps,
    frameTime: obsStats.averageFrameRenderTime,
    t: "",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<Cpu className="h-4 w-4 text-green-500" />}
          label="CPU Usage"
          value={`${latest.cpu.toFixed(1)}%`}
          sub="OBS process"
          color="bg-green-500/10"
        />
        <StatCard
          icon={<MemoryStick className="h-4 w-4 text-blue-500" />}
          label="Memory"
          value={`${(latest.ram / 1024).toFixed(1)} GB`}
          sub="OBS process"
          color="bg-blue-500/10"
        />
        <StatCard
          icon={<MonitorPlay className="h-4 w-4 text-yellow-500" />}
          label="FPS"
          value={`${latest.fps.toFixed(1)}`}
          sub={`${obsStats.renderSkippedFrames} skipped`}
          color="bg-yellow-500/10"
        />
        <StatCard
          icon={<Gauge className="h-4 w-4 text-purple-500" />}
          label="Frame Time"
          value={`${latest.frameTime.toFixed(1)} ms`}
          sub={`${obsStats.outputSkippedFrames} dropped`}
          color="bg-purple-500/10"
        />
      </div>

      {samples.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">CPU %</p>
            <MiniChart data={samples} dataKey="cpu" color="hsl(142 71% 45%)" unit="%" />
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Memory (MB)</p>
            <MiniChart data={samples} dataKey="ram" color="hsl(217 91% 60%)" unit=" MB" />
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">FPS</p>
            <MiniChart data={samples} dataKey="fps" color="hsl(45 93% 58%)" unit=" fps" />
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Frame Time (ms)</p>
            <MiniChart data={samples} dataKey="frameTime" color="hsl(270 91% 65%)" unit=" ms" />
          </div>
        </div>
      )}
    </div>
  );
}
