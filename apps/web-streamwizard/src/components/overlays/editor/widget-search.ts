/** The parts of a registry entry the picker searches over. */
export interface SearchableWidget {
  type: string;
  library?: { title?: string; description?: string };
}

/**
 * Rank buckets, best first. A title match beats a description match, and a
 * title that starts with the query beats one that merely contains it — typing
 * "clip" should put "Clips" above "Alert box" just because its description
 * happens to mention clips.
 */
const enum Rank {
  TitlePrefix = 0,
  TitleContains = 1,
  DescriptionContains = 2,
  NoMatch = 3,
}

function rank(widget: SearchableWidget, query: string): Rank {
  const title = (widget.library?.title ?? widget.type).toLowerCase();
  if (title.startsWith(query)) return Rank.TitlePrefix;
  if (title.includes(query)) return Rank.TitleContains;
  if ((widget.library?.description ?? "").toLowerCase().includes(query)) {
    return Rank.DescriptionContains;
  }
  return Rank.NoMatch;
}

/**
 * Widgets matching a query, best match first.
 *
 * An empty query returns everything in registry order, so the caller can treat
 * "no search" and "search for nothing" the same way. Ties keep registry order,
 * which is stable and deliberate rather than alphabetical by accident.
 */
export function filterLibraryWidgets<T extends SearchableWidget>(
  widgets: T[],
  query: string
): T[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return widgets;

  return widgets
    .map((widget, index) => ({ widget, index, rank: rank(widget, needle) }))
    .filter((entry) => entry.rank !== Rank.NoMatch)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.widget);
}
