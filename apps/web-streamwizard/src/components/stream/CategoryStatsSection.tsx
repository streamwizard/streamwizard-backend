import { getCategoryStatsData } from "@/actions/supabase/analytics/category-stats";
import { CategoryStatsTable } from "@/components/stream-analytics/category-stats-table";

interface CategoryStatsSectionProps {
  streamId: string;
  broadcasterId: string;
}

export async function CategoryStatsSection({ streamId, broadcasterId }: CategoryStatsSectionProps) {
  const segments = await getCategoryStatsData(streamId, broadcasterId);

  return <CategoryStatsTable segments={segments} />;
}
