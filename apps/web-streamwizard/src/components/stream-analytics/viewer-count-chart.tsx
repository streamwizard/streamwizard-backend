"use client";

import { useMemo } from "react";
import { useModal } from "@/providers/modal-provider";
import TwitchClipModal from "@/components/modals/twitch-clip-modal";
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { ViewerCountBucket, ClipData, RawEvent } from "@/actions/supabase/analytics/stream-analytics";
import { formatOffset } from "@/lib/format";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// Linear interpolation between the two nearest viewer-count buckets surrounding offsetSeconds.
function interpolateViewers(buckets: ViewerCountBucket[], offsetSeconds: number): number {
  if (buckets.length === 0) return 0;
  const before = [...buckets].reverse().find((b) => b.bucket <= offsetSeconds);
  const after = buckets.find((b) => b.bucket > offsetSeconds);
  if (!before) return after?.viewers ?? 0;
  if (!after) return before.viewers;
  const t = (offsetSeconds - before.bucket) / (after.bucket - before.bucket);
  return Math.round(before.viewers + t * (after.viewers - before.viewers));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  // Clip scatter point
  if (point._type === "clip") {
    return (
      <div className="min-w-[180px] space-y-1 rounded-lg border bg-popover p-3 text-sm shadow-md">
        <p className="font-semibold text-amber-500">📹 Clip</p>
        <p className="text-muted-foreground">{formatOffset(point.offset)}</p>
        <p className="line-clamp-2">{point.title}</p>
        <p className="text-xs text-muted-foreground">{point.view_count?.toLocaleString()} views</p>
      </div>
    );
  }

  // Sub scatter point
  if (point._type === "sub") {
    return (
      <div className="space-y-1 rounded-lg border bg-popover p-3 text-sm shadow-md">
        <p className="font-semibold text-purple-400">⭐ Subscription</p>
        <p className="text-muted-foreground">{formatOffset(point.offset)}</p>
        <p>{point.viewers?.toLocaleString()} viewers</p>
      </div>
    );
  }

  // Follow scatter point
  if (point._type === "follow") {
    return (
      <div className="space-y-1 rounded-lg border bg-popover p-3 text-sm shadow-md">
        <p className="font-semibold text-green-400">👥 Follow</p>
        <p className="text-muted-foreground">{formatOffset(point.offset)}</p>
        <p>{point.viewers?.toLocaleString()} viewers</p>
      </div>
    );
  }

  // Line hover
  return (
    <div className="space-y-1 rounded-lg border bg-popover p-3 text-sm shadow-md">
      <p className="font-semibold">{formatOffset(point.offset)}</p>
      <p className="text-muted-foreground">{point.viewers?.toLocaleString()} viewers</p>
    </div>
  );
}

interface ViewerCountChartProps {
  viewerBuckets: ViewerCountBucket[];
  subEvents: RawEvent[];
  followEvents: RawEvent[];
  clips: ClipData[];
}

export function ViewerCountChart({
  viewerBuckets,
  subEvents,
  followEvents,
  clips,
}: ViewerCountChartProps) {
  const { openModal } = useModal();
  const { lineData, subPoints, followPoints, clipPoints, xTicks, domain } = useMemo(() => {
    const lineData = viewerBuckets.map((b) => ({ offset: b.bucket, viewers: b.viewers }));

    const subPoints = subEvents.map((e) => ({
      offset: e.offsetSeconds,
      viewers: interpolateViewers(viewerBuckets, e.offsetSeconds),
      _type: "sub",
    }));

    const followPoints = followEvents.map((e) => ({
      offset: e.offsetSeconds,
      viewers: interpolateViewers(viewerBuckets, e.offsetSeconds),
      _type: "follow",
    }));

    const clipPoints = clips
      .filter((c) => c.vod_offset != null)
      .map((c) => ({
        offset: c.vod_offset!,
        viewers: interpolateViewers(viewerBuckets, c.vod_offset!),
        _type: "clip",
        title: c.title,
        view_count: c.view_count,
        _clip: c,
      }));

    const maxOffset =
      viewerBuckets.length > 0 ? viewerBuckets[viewerBuckets.length - 1].bucket : 0;
    const domain: [number, number] = [0, maxOffset + 300];

    // ~12 evenly-spaced ticks from the viewer buckets
    const every = Math.max(1, Math.ceil(viewerBuckets.length / 12));
    const xTicks = viewerBuckets.filter((_, i) => i % every === 0).map((b) => b.bucket);

    return { lineData, subPoints, followPoints, clipPoints, xTicks, domain };
  }, [viewerBuckets, subEvents, followEvents, clips]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Viewers over time</CardTitle>
        <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
            Clip
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-purple-500" />
            Sub
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
            Follow
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis
              type="number"
              dataKey="offset"
              domain={domain}
              ticks={xTicks}
              tickFormatter={formatOffset}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatNumber}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Viewer count line */}
            <Line
              data={lineData}
              type="monotone"
              dataKey="viewers"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#6366f1" }}
              animationDuration={1000}
              animationEasing="ease-out"
            />

            {/* Clip markers — exact vod_offset */}
            <Scatter
              data={clipPoints}
              dataKey="viewers"
              fill="#f59e0b"
              stroke="white"
              strokeWidth={1.5}
              r={7}
              onClick={(point) => {
                const clip = point.payload?._clip as ClipData | undefined;
                if (clip?.embed_url) openModal(<TwitchClipModal url={clip.embed_url} />);
              }}
              style={{ cursor: clipPoints.length > 0 ? "pointer" : "default" }}
            />

            {/* Sub markers — exact offset */}
            <Scatter
              data={subPoints}
              dataKey="viewers"
              fill="#a855f7"
              stroke="white"
              strokeWidth={1.5}
              r={5}
            />

            {/* Follow markers — exact offset */}
            <Scatter
              data={followPoints}
              dataKey="viewers"
              fill="#22c55e"
              stroke="white"
              strokeWidth={1.5}
              r={4}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
