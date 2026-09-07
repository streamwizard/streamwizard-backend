import { streamEventsLogger } from "@repo/logger";
import { supabase } from "@repo/supabase";
import { getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import type { AutoSwitcherSwitchEntry } from "@repo/schemas";
import type { IngestStatsPayload } from "@repo/types";

// stream_events insert for a scene switch. The logger resolves the live
// stream_id + offset from broadcaster_live_status and skips (returns false)
// when the user isn't live on Twitch — the in-memory switch log is the
// always-on record; this feeds the activity feed / VOD timeline.
export async function logSwitchEvent(
  userId: string,
  entry: AutoSwitcherSwitchEntry,
  metrics: IngestStatsPayload | null,
): Promise<void> {
  try {
    const broadcasterId = await getTwitchUserIdByUserIdMaybe(supabase, userId);
    if (!broadcasterId) return;

    await streamEventsLogger.logStreamwizardEvent({
      broadcaster_id: broadcasterId,
      event_type: "obs.scene_switch",
      event_data: {
        from_scene: entry.from_scene,
        to_scene: entry.to_scene,
        reason: entry.reason,
        detail: entry.detail,
        session_id: entry.session_id,
        label: entry.label,
        metrics_snapshot: metrics
          ? {
              kbps: metrics.kbps ?? null,
              rtt_ms: metrics.rtt_ms ?? null,
              // Both: drop_pct is what the switcher decided on, raw loss_pct
              // tells you afterwards whether the link was lossy but recovering.
              loss_pct: metrics.loss_pct ?? null,
              drop_pct: metrics.drop_pct ?? null,
              protocol: metrics.protocol,
            }
          : null,
      },
      metadata: { source: "obs-auto-switcher" },
    });
  } catch (err) {
    console.warn(`[event-log] stream_events insert failed user=${userId}:`, (err as Error).message);
  }
}
