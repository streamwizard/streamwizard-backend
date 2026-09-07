import { getHourlyViewerStatsData } from "@/actions/supabase/analytics/hourly-stats";
import { HourlyViewerChart } from "@/components/stream-analytics/hourly-viewer-chart";

interface HourlyStatsSectionProps {
  streamId: string;
  broadcasterId: string;
  streamStartedAt: string;
}

export async function HourlyStatsSection({
  streamId,
  broadcasterId,
  streamStartedAt,
}: HourlyStatsSectionProps) {
  const hourly = await getHourlyViewerStatsData(streamId, broadcasterId, streamStartedAt);

  return <HourlyViewerChart hourlyStats={hourly} />;
}
