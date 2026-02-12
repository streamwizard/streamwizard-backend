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
  const video = await TwitchAPI.videos.getVodByBroadcasterId(event.broadcaster_user_id);

  if (!stream) {
    console.error("Stream not found", { event });
    return;
  }

  const video_id = video.data.find((v) => v.stream_id === stream.id)?.id;

  if (!video_id) {
    console.error("Video not found", { event });
    return;
  }

  const { error: videoError } = await supabase.from("vods").insert({
    broadcaster_id: stream.user_id,
    video_id: video_id,
    stream_id: stream.id,
    started_at: stream.started_at,
  });

  if (videoError) {
    console.error("Error inserting vod", { videoError });
    throw videoError;
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
