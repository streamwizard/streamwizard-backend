import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import { withMetrics } from "./with-metrics";

/** The stream_events timeline, plus the live-status reads that stamp each row. */

type DBClient = SupabaseClient<Database>;
type StreamEventInsert = Database["public"]["Tables"]["stream_events"]["Insert"];

export const insertStreamEvent = withMetrics(
  "stream_events",
  "insert",
  async (client: DBClient, event: StreamEventInsert) => client.from("stream_events").insert(event),
);

/** The broadcaster's current stream id, or null when they aren't live. */
export const selectLiveStreamId = withMetrics(
  "broadcaster_live_status",
  "select",
  async (client: DBClient, broadcasterId: string) =>
    client
      .from("broadcaster_live_status")
      .select("stream_id")
      .eq("broadcaster_id", broadcasterId)
      .eq("is_live", true)
      .single(),
);

/** When the broadcaster's current stream started — the origin for event offsets. */
export const selectStreamStartedAt = withMetrics(
  "broadcaster_live_status",
  "select",
  async (client: DBClient, broadcasterId: string) =>
    client.from("broadcaster_live_status").select("stream_started_at").eq("broadcaster_id", broadcasterId),
);
