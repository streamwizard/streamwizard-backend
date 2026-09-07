"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Sparkles, UserPlus, Gift, Swords, HandMetal, Zap, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui";
import type { HourlyViewerStat } from "@/lib/analytics/hourly-buckets";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatClockHour(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric" });
}

function formatHourRange(startTime: string, endTime: string): string {
  return `${formatClockHour(startTime)} – ${formatClockHour(endTime)}`;
}

type HourlyViewerStatWithLabel = HourlyViewerStat & { label: string };

function explainBestHour(
  bestHour: HourlyViewerStatWithLabel,
  allStats: HourlyViewerStatWithLabel[]
): string {
  const otherHours = allStats.filter((s) => s.hour !== bestHour.hour);
  const maxOtherAvgViewers = otherHours.length ? Math.max(...otherHours.map((s) => s.avgViewers)) : 0;
  const maxOtherInteractions = otherHours.length
    ? Math.max(...otherHours.map((s) => s.totalInteractions))
    : 0;

  if (otherHours.length === 0) {
    return `Only one full hour to compare so far. ${bestHour.label} had ${bestHour.avgViewers} avg viewers and ${bestHour.totalInteractions} interactions.`;
  }

  const viewerLead = bestHour.avgViewers > maxOtherAvgViewers;
  const interactionLead = bestHour.totalInteractions > maxOtherInteractions;

  if (viewerLead && interactionLead) {
    return `${bestHour.label} won on both counts: ${bestHour.avgViewers} avg viewers and ${bestHour.totalInteractions} interactions, both the highest of the stream.`;
  }
  if (viewerLead) {
    return `${bestHour.label} pulled in the most viewers this stream: ${bestHour.avgViewers} avg viewers, ahead of ${maxOtherAvgViewers} in your next-best hour.`;
  }
  if (interactionLead) {
    return `${bestHour.label} wasn't your highest-viewed hour, but it had the most chat activity: ${bestHour.totalInteractions} follows, subs, bits, raids and redemptions combined.`;
  }
  return `${bestHour.label} ranked highest once we combine viewers and chat activity. No single stat was the highest on its own, but together they beat every other hour.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as HourlyViewerStatWithLabel;

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-popover p-3 text-sm shadow-lg backdrop-blur-sm">
      <p className="flex items-center gap-1.5 font-semibold text-popover-foreground">
        {point.label}
        {point.isBestHour && <span className="text-xs text-amber-500">★ best hour</span>}
      </p>
      <p className="text-muted-foreground">{point.avgViewers.toLocaleString()} avg viewers</p>
      <p className="text-muted-foreground">{point.peakViewers.toLocaleString()} peak viewers</p>
      {point.totalInteractions > 0 && (
        <p className="text-muted-foreground">
          {point.follows} follows · {point.subs} subs · {point.bits} bits · {point.raids} raids ·{" "}
          {point.redemptions} redemptions
        </p>
      )}
    </div>
  );
}

interface HourlyViewerChartProps {
  hourlyStats: HourlyViewerStat[];
}

export function HourlyViewerChart({ hourlyStats }: HourlyViewerChartProps) {
  const chartData: HourlyViewerStatWithLabel[] = hourlyStats.map((s) => ({
    ...s,
    label: formatHourRange(s.startTime, s.endTime),
  }));
  const bestHour = chartData.find((s) => s.isBestHour) ?? null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Best time to stream</CardTitle>
      </CardHeader>
      <CardContent>
        {hourlyStats.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hourly data yet. Once you&apos;ve streamed past the first hour, it&apos;ll show up here.
          </p>
        ) : (
          <div className="space-y-4">
            {bestHour && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm">
                <span className="flex items-center gap-1.5 font-medium text-amber-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  {bestHour.label} was your best time to stream
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Why this hour?"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 space-y-2 text-sm">
                    <p className="font-medium">Why this hour?</p>
                    <p className="text-muted-foreground">
                      We rank each hour by viewers and chat activity together: follows, subs,
                      bits, raids and channel point redemptions.
                    </p>
                    <p>{explainBestHour(bestHour, chartData)}</p>
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">{bestHour.peakViewers.toLocaleString()} peak viewers</span>
                {bestHour.follows > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <UserPlus className="h-3 w-3" />
                    {bestHour.follows}
                  </span>
                )}
                {bestHour.subs > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Gift className="h-3 w-3" />
                    {bestHour.subs}
                  </span>
                )}
                {bestHour.bits > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    {bestHour.bits}
                  </span>
                )}
                {bestHour.raids > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Swords className="h-3 w-3" />
                    {bestHour.raids}
                  </span>
                )}
                {bestHour.redemptions > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <HandMetal className="h-3 w-3" />
                    {bestHour.redemptions}
                  </span>
                )}
              </div>
            )}

            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={formatNumber}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "currentColor", className: "fill-foreground/5", radius: 4 }}
                />
                <Bar dataKey="avgViewers" radius={[4, 4, 0, 0]} animationDuration={1000}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.hour}
                      fill={entry.isBestHour ? "#f59e0b" : "#6366f1"}
                      className="transition-opacity hover:opacity-80"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
