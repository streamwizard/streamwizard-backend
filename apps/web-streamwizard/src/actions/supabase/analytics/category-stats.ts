"use server";

import { cache } from "react";
import { createClient } from "@repo/supabase/next/server";
import { getStreamViewerCounts, getStreamEvents } from "@repo/supabase/queries/stream-analytics";
import { buildCategorySegments, type CategorySegmentStats } from "@/lib/analytics/category-segments";

export const getCategoryStatsData = cache(
  async (streamId: string, broadcasterId: string): Promise<CategorySegmentStats[]> => {
    const supabase = await createClient();
    const [viewerRows, eventRows] = await Promise.all([
      getStreamViewerCounts(supabase, streamId),
      getStreamEvents(supabase, streamId),
    ]);

    return buildCategorySegments(viewerRows, eventRows);
  }
);
