"use client";

import dynamic from "next/dynamic";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@repo/ui";
import { ModalProvider } from "@/providers/modal-provider";
import { ActivityFeedItem } from "@/components/stream/ActivityFeed/ActivityFeedItem";
import { CategoryStatsTable } from "@/components/stream-analytics/category-stats-table";
import {
  demoActivityEvents,
  demoCategorySegments,
  demoClips,
  demoFollowEvents,
  demoHourlyStats,
  demoSubEvents,
  demoViewerBuckets,
} from "./demo-data";

/*
 * The real dashboard charts, fed with the demo stream. They stay out of the
 * server render (recharts plus locale-formatted timestamps would hydrate
 * differently), so each slot reserves its height to avoid layout shift.
 * ModalProvider satisfies ViewerCountChart's useModal call; every demo clip
 * has embed_url null, so the modal can never open.
 */

const ViewerCountChart = dynamic(
  () => import("@/components/stream-analytics/viewer-count-chart").then((m) => m.ViewerCountChart),
  { ssr: false, loading: () => <Skeleton className="h-[340px] w-full rounded-xl" /> },
);

const HourlyViewerChart = dynamic(
  () => import("@/components/stream-analytics/hourly-viewer-chart").then((m) => m.HourlyViewerChart),
  { ssr: false, loading: () => <Skeleton className="h-[380px] w-full rounded-xl" /> },
);

export function AnalyticsDemoPanels() {
  return (
    <ModalProvider>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-h-[340px] min-w-0 lg:col-span-2">
          <ViewerCountChart
            viewerBuckets={demoViewerBuckets}
            subEvents={demoSubEvents}
            followEvents={demoFollowEvents}
            clips={demoClips}
          />
        </div>
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" aria-hidden="true" />
              Activity feed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            {demoActivityEvents.map((event) => (
              <ActivityFeedItem key={event.id} event={event} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="min-h-[380px] min-w-0">
          <HourlyViewerChart hourlyStats={demoHourlyStats} />
        </div>
        <div className="min-w-0 overflow-x-auto">
          <CategoryStatsTable segments={demoCategorySegments} />
        </div>
      </div>
    </ModalProvider>
  );
}
