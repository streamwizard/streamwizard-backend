"use client";

import { useCallback } from "react";
import { captureEvent } from "@repo/posthog";

/*
 * `demo_interacted` for the playable mocks on the public pages.
 *
 * Every interaction counts, but not unthrottled: some demos call track from
 * pointer-move handlers (scrubbing the VOD timeline), request batching is
 * off, and each event is its own HTTP request. So per (demo, action):
 *
 *   - the first call sends immediately with `first_touch: true` — insights
 *     asking "did they touch it" filter on that and keep their old meaning;
 *   - repeats send with `first_touch: false`, at most one per THROTTLE_MS
 *     and MAX_PER_ACTION per page visit — "how much they touched it" is the
 *     plain event count.
 *
 * The registry is module-level and keyed by pathname, not per hook instance:
 * the clip lightbox is mounted by both the marquee and the folders mock on
 * the same page, and per-instance state would double-count the same click.
 * Navigating to another page clears the registry, so a return visit counts
 * again.
 */
const THROTTLE_MS = 2_000;
const MAX_PER_ACTION = 25;

type ActionStat = { sent: number; lastSentAt: number };
const statsByPage = new Map<string, Map<string, ActionStat>>();

export function useDemoTracking(demo: string) {
  return useCallback(
    (action: string, properties?: Record<string, unknown>) => {
      const page = window.location.pathname;
      let stats = statsByPage.get(page);
      if (!stats) {
        statsByPage.clear();
        stats = new Map();
        statsByPage.set(page, stats);
      }
      const key = `${demo}:${action}`;
      const now = Date.now();
      const stat = stats.get(key);
      if (stat) {
        if (stat.sent >= MAX_PER_ACTION || now - stat.lastSentAt < THROTTLE_MS) return;
        stat.sent += 1;
        stat.lastSentAt = now;
        captureEvent("demo_interacted", { demo, action, first_touch: false, ...properties });
        return;
      }
      stats.set(key, { sent: 1, lastSentAt: now });
      captureEvent("demo_interacted", { demo, action, first_touch: true, ...properties });
    },
    [demo],
  );
}
