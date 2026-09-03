/**
 * Splitter positions for the timeline modal. A working preference like the
 * canvas grid: lives in localStorage, follows the streamer across every
 * alert, never touches the overlay document.
 */

export const ALERT_TIMELINE_LAYOUT_KEY = "alert-timeline-layout";

/** react-resizable-panels layouts: panel id -> percent of the group. */
export type PanelLayout = Record<string, number>;

export interface TimelineLayout {
  rows: PanelLayout;
  columns: PanelLayout;
}

export const DEFAULT_TIMELINE_LAYOUT: TimelineLayout = {
  rows: { top: 60, timeline: 40 },
  columns: { preview: 72, inspector: 28 },
};

function readKey(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // Storage refused: the modal still works, it just forgets.
  }
}

function validLayout(raw: unknown, fallback: PanelLayout): PanelLayout {
  if (!raw || typeof raw !== "object") return fallback;
  const out: PanelLayout = {};
  for (const id of Object.keys(fallback)) {
    const v = (raw as Record<string, unknown>)[id];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 100) return fallback;
    out[id] = v;
  }
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 100) > 1) return fallback;
  return out;
}

export function parseTimelineLayout(raw: string | null): TimelineLayout {
  if (!raw) return DEFAULT_TIMELINE_LAYOUT;
  try {
    const parsed = JSON.parse(raw) as Partial<TimelineLayout>;
    return {
      rows: validLayout(parsed.rows, DEFAULT_TIMELINE_LAYOUT.rows),
      columns: validLayout(parsed.columns, DEFAULT_TIMELINE_LAYOUT.columns),
    };
  } catch {
    return DEFAULT_TIMELINE_LAYOUT;
  }
}

export function loadTimelineLayout(): TimelineLayout {
  return parseTimelineLayout(readKey(ALERT_TIMELINE_LAYOUT_KEY));
}

export function saveTimelineLayout(layout: TimelineLayout): void {
  writeKey(ALERT_TIMELINE_LAYOUT_KEY, JSON.stringify(layout));
}
