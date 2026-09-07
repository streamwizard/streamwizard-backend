"use server";

import { cache } from "react";
import { createClient } from "@repo/supabase/next/server";
import { getStreamViewerCounts, getStreamEvents } from "@repo/supabase/queries/stream-analytics";
import { bucketIntoHours, type HourlyViewerStat } from "@/lib/analytics/hourly-buckets";

export const getHourlyViewerStatsData = cache(
  async (
    streamId: string,
    broadcasterId: string,
    streamStartedAt: string
  ): Promise<HourlyViewerStat[]> => {
    const supabase = await createClient();
    const [viewerRows, eventRows] = await Promise.all([
      getStreamViewerCounts(supabase, streamId),
      getStreamEvents(supabase, streamId),
    ]);
    return bucketIntoHours(viewerRows, eventRows, streamStartedAt);
  }
);
