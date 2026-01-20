import { supabase } from "@repo/supabase";
import { TwitchApi } from "@repo/twitch-api";
import type { StreamOnlineEvent } from "@repo/schemas";
import { streamEventsLogger } from "@repo/logger";
import { viewerCountPoller } from "../../services/viewer-count-poller";

export const handleStreamOnline = async (event: StreamOnlineEvent, TwitchAPI: TwitchApi) => {
  //   check if the stream is of type "live"
  if (event.type !== "live") return;

  // get the stream data from the twitch api
  const stream = await TwitchAPI.streams.getStream({ type: "live" });

  if (!stream) {
    console.error("Stream not found", { event });
    return;
  }

  // update the database with the stream online event
  const { error } = await supabase.from("broadcaster_live_status").upsert(
    {
      broadcaster_id: stream.user_id,
      broadcaster_name: stream.user_name,
      is_live: true,
      stream_started_at: stream.started_at,
      title: stream.title,
      stream_id: stream.id,
      category_id: stream.game_id,
      category_name: stream.game_name,
    },
    {
      onConflict: "broadcaster_id",
    },
  );

  await streamEventsLogger.logTwitchEvent({
    broadcaster_id: stream.user_id,
    event_type: "stream.online",
    event_data: event,
    metadata: null,
  });

  if (error) {
    console.error("Error updating broadcaster live status", { error });
    throw error;
  }

  // Start polling viewer counts for this stream
  viewerCountPoller.startPolling(stream.user_id, stream.id);
};
