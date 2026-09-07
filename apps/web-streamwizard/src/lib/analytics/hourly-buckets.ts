import { SUB_EVENT_TYPES } from "@/lib/utils/stream-events";

const HOUR_SECONDS = 3600;
const FOLLOW_TYPE = "channel.follow";
const CHEER_TYPE = "channel.cheer";
const RAID_TYPE = "channel.raid";
const REDEMPTION_TYPE = "channel.channel_points_custom_reward_redemption.add";

export interface HourlyViewerStat {
  hour: number;
  startTime: string;
  endTime: string;
  avgViewers: number;
  peakViewers: number;
  follows: number;
  subs: number;
  bits: number;
  raids: number;
  redemptions: number;
  totalInteractions: number;
  engagementScore: number;
  isBestHour: boolean;
}

interface ViewerRow {
  offset_seconds: number;
  viewer_count: number;
}

interface EventRow {
  event_type: string;
  event_data: unknown;
  offset_seconds: number;
}

export function bucketIntoHours(
  viewerRows: ViewerRow[],
  eventRows: EventRow[] = [],
  streamStartedAt: string
): HourlyViewerStat[] {
  const streamStartMs = new Date(streamStartedAt).getTime();
  const byHour = new Map<number, number[]>();
  for (const row of viewerRows) {
    const hourIndex = Math.floor(row.offset_seconds / HOUR_SECONDS);
    const values = byHour.get(hourIndex) ?? [];
    values.push(row.viewer_count);
    byHour.set(hourIndex, values);
  }

  const eventsByHour = new Map<number, EventRow[]>();
  for (const event of eventRows) {
    const hourIndex = Math.floor(event.offset_seconds / HOUR_SECONDS);
    const events = eventsByHour.get(hourIndex) ?? [];
    events.push(event);
    eventsByHour.set(hourIndex, events);
  }

  const maxAvgViewers = Math.max(
    1,
    ...[...byHour.values()].map((values) => values.reduce((a, b) => a + b, 0) / values.length)
  );

  const stats = [...byHour.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hourIndex, values]) => {
      const events = eventsByHour.get(hourIndex) ?? [];
      const follows = events.filter((e) => e.event_type === FOLLOW_TYPE).length;
      const subs = events.filter((e) => (SUB_EVENT_TYPES as readonly string[]).includes(e.event_type)).length;
      const bits = events
        .filter((e) => e.event_type === CHEER_TYPE)
        .reduce((sum, e) => {
          const d = e.event_data as Record<string, unknown>;
          return sum + (typeof d?.bits === "number" ? d.bits : 0);
        }, 0);
      const raids = events.filter((e) => e.event_type === RAID_TYPE).length;
      const redemptions = events.filter((e) => e.event_type === REDEMPTION_TYPE).length;
      const totalInteractions = follows + subs + raids + redemptions;

      const avgViewers = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

      return {
        hour: hourIndex + 1,
        startTime: new Date(streamStartMs + hourIndex * HOUR_SECONDS * 1000).toISOString(),
        endTime: new Date(streamStartMs + (hourIndex + 1) * HOUR_SECONDS * 1000).toISOString(),
        avgViewers,
        peakViewers: Math.max(...values),
        follows,
        subs,
        bits,
        raids,
        redemptions,
        totalInteractions,
        avgViewersNormalized: avgViewers / maxAvgViewers,
      };
    });

  const maxInteractions = Math.max(1, ...stats.map((s) => s.totalInteractions));

  const scores = stats.map(
    (s) => s.avgViewersNormalized / 2 + s.totalInteractions / maxInteractions / 2
  );
  const bestScore = Math.max(...scores);

  return stats.map((s, i) => ({
    hour: s.hour,
    startTime: s.startTime,
    endTime: s.endTime,
    avgViewers: s.avgViewers,
    peakViewers: s.peakViewers,
    follows: s.follows,
    subs: s.subs,
    bits: s.bits,
    raids: s.raids,
    redemptions: s.redemptions,
    totalInteractions: s.totalInteractions,
    engagementScore: scores[i],
    isBestHour: scores[i] === bestScore,
  }));
}
