import { SUB_EVENT_TYPES } from "@/lib/utils/stream-events";

const FOLLOW_TYPE = "channel.follow";
const CHEER_TYPE = "channel.cheer";
const MIN_SEGMENT_DURATION_SECONDS = 60;

export interface CategorySegmentStats {
  gameId: string | null;
  gameName: string | null;
  startSeconds: number;
  endSeconds: number | null;
  durationSeconds: number;
  avgViewers: number;
  peakViewers: number;
  follows: number;
  subs: number;
  bits: number;
}

interface ViewerRow {
  offset_seconds: number;
  viewer_count: number;
  game_id: string | null;
  game_name: string | null;
}

interface EventRow {
  event_type: string;
  event_data: unknown;
  offset_seconds: number;
}

interface RawSegment {
  gameId: string | null;
  gameName: string | null;
  startSeconds: number;
  endSeconds: number;
  viewerCounts: number[];
}

// Collapses consecutive viewer-count rows into segments whenever game_id changes,
// then drops segments under MIN_SEGMENT_DURATION_SECONDS (brief category flickers).
// Dropped segments' viewers/events are excluded from this view only — other
// dashboard totals are computed independently from the full row set.
export function buildCategorySegments(
  viewerRows: ViewerRow[],
  eventRows: EventRow[]
): CategorySegmentStats[] {
  if (viewerRows.length === 0) return [];

  const rawSegments: RawSegment[] = [];
  let current: RawSegment = {
    gameId: viewerRows[0].game_id,
    gameName: viewerRows[0].game_name,
    startSeconds: viewerRows[0].offset_seconds,
    endSeconds: viewerRows[0].offset_seconds,
    viewerCounts: [viewerRows[0].viewer_count],
  };

  for (let i = 1; i < viewerRows.length; i++) {
    const row = viewerRows[i];
    if (row.game_id !== current.gameId) {
      rawSegments.push(current);
      current = {
        gameId: row.game_id,
        gameName: row.game_name,
        startSeconds: row.offset_seconds,
        endSeconds: row.offset_seconds,
        viewerCounts: [row.viewer_count],
      };
    } else {
      current.endSeconds = row.offset_seconds;
      current.viewerCounts.push(row.viewer_count);
    }
  }
  rawSegments.push(current);

  const surviving = rawSegments.filter(
    (s) => s.endSeconds - s.startSeconds >= MIN_SEGMENT_DURATION_SECONDS
  );

  return surviving.map((segment, index) => {
    const isLast = index === surviving.length - 1;
    const rangeEnd = isLast ? Infinity : segment.endSeconds;

    const eventsInRange = eventRows.filter(
      (e) => e.offset_seconds >= segment.startSeconds && e.offset_seconds <= rangeEnd
    );

    const follows = eventsInRange.filter((e) => e.event_type === FOLLOW_TYPE).length;
    const subs = eventsInRange.filter((e) =>
      (SUB_EVENT_TYPES as readonly string[]).includes(e.event_type)
    ).length;
    const bits = eventsInRange
      .filter((e) => e.event_type === CHEER_TYPE)
      .reduce((sum, e) => {
        const d = e.event_data as Record<string, unknown>;
        return sum + (typeof d?.bits === "number" ? d.bits : 0);
      }, 0);

    return {
      gameId: segment.gameId,
      gameName: segment.gameName,
      startSeconds: segment.startSeconds,
      endSeconds: isLast ? null : segment.endSeconds,
      durationSeconds: segment.endSeconds - segment.startSeconds,
      avgViewers: Math.round(
        segment.viewerCounts.reduce((a, b) => a + b, 0) / segment.viewerCounts.length
      ),
      peakViewers: Math.max(...segment.viewerCounts),
      follows,
      subs,
      bits,
    };
  });
}
