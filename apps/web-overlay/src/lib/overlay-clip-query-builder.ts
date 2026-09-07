import type { ClipsWidgetConfig, TimeWindowPreset } from "@/types/overlays";

export function getTimeWindowDates(
  timeWindow: TimeWindowPreset,
  customRange?: { start?: string; end?: string }
): { start?: string; end?: string } {
  if (timeWindow === "all") return {};

  if (timeWindow === "custom" && customRange) {
    return {
      start: customRange.start
        ? new Date(customRange.start).toISOString()
        : undefined,
      end: customRange.end
        ? new Date(customRange.end).toISOString()
        : undefined,
    };
  }

  const now = new Date();
  const daysMap: Record<string, number> = {
    last7d: 7,
    last30d: 30,
    last90d: 90,
    last365d: 365,
  };

  const days = daysMap[timeWindow];
  if (!days) return {};

  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString() };
}

/**
 * Sort column per non-random option, with `id` as the tiebreak. Exported because
 * the widget pages through clips one at a time with a keyset cursor and has to
 * build the "row after this one" predicate from the same column and direction.
 */
export const CLIP_SORT_COLUMNS: Record<
  string,
  { column: string; ascending: boolean }
> = {
  newest: { column: "created_at_twitch", ascending: false },
  oldest: { column: "created_at_twitch", ascending: true },
  most_viewed: { column: "view_count", ascending: false },
  least_viewed: { column: "view_count", ascending: true },
};

/**
 * Same layering as the main app overlay editor: filters + optional sort on `clips`,
 * before broadcaster / folder scope. Random uses no SQL sort; the DB picks the row.
 *
 * Does **not** apply `.limit()` — callers must chain broadcaster/folder filters first,
 * then `.limit()` last (see `getNextOverlayClip`).
 */
export function buildOverlayClipQuery<T>(
  config: ClipsWidgetConfig,
  query: T,
  options?: { userId?: string }
): T {
  type Q = T & {
    eq: (column: string, value: unknown) => T;
    gte: (column: string, value: unknown) => T;
    lte: (column: string, value: unknown) => T;
    in: (column: string, values: unknown[]) => T;
    order: (
      column: string,
      opts?: { ascending: boolean; nullsFirst?: boolean }
    ) => T;
  };

  const chain = (x: T) => x as Q;

  let result: T = query;

  if (options?.userId) {
    result = chain(result).eq("user_id", options.userId);
  }

  if (config.gameIds.length > 0) {
    result = chain(result).in("game_id", config.gameIds);
  }

  if (config.creatorIds.length > 0) {
    result = chain(result).in("creator_id", config.creatorIds);
  }

  if (config.isFeaturedOnly) {
    result = chain(result).eq("is_featured", true);
  }

  if (config.minViewCount > 0) {
    result = chain(result).gte("view_count", config.minViewCount);
  }

  const { start, end } = getTimeWindowDates(
    config.timeWindow,
    config.customDateRange
  );
  if (start) {
    result = chain(result).gte("created_at_twitch", start);
  }
  if (end) {
    result = chain(result).lte("created_at_twitch", end);
  }

  if (config.sort !== "random") {
    const sortConfig = CLIP_SORT_COLUMNS[config.sort];
    if (sortConfig) {
      // `nullsFirst: false` in both directions so a nullable column (view_count)
      // orders the same way ascending and descending — otherwise Postgres puts
      // NULLs first on DESC and the keyset cursor walks off the end immediately.
      result = chain(result).order(sortConfig.column, {
        ascending: sortConfig.ascending,
        nullsFirst: false,
      });
      result = chain(result).order("id", { ascending: sortConfig.ascending });
    }
  }

  return result;
}
