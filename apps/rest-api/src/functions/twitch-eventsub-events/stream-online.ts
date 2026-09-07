import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { insertVod } from "@repo/supabase/queries/vods";
import { upsertBroadcasterLiveStatus } from "@repo/supabase/queries/live-status";
import { TwitchApi } from "@repo/twitch-api";
import type { StreamOnlineEvent } from "@repo/schemas";
import { streamEventsLogger } from "@repo/logger";
import { viewerCountPoller } from "../../services/viewer-count-poller";
import { notifyStreamStatus } from "../../lib/ws-server";
import { setStreamUserState } from "../../lib/user-state";

export const handleStreamOnline = async (event: StreamOnlineEvent, TwitchAPI: TwitchApi) => {
  //   check if the stream is of type "live"
  if (event.type !== "live") return;

  // get the stream data from the twitch api
  const stream = await TwitchAPI.streams.getStream({ type: "live" });
  const video = await TwitchAPI.videos.getVodByBroadcasterId(event.broadcaster_user_id);

  // Both bail-outs abandon the whole stream.online pipeline — no vod row, no
  // live status, no user_state, no viewer polling — while returning normally,
  // so nothing downstream can tell this apart from a handled event.
  if (!stream) {
    reportError(new Error("stream.online: stream not found"), "eventsub.stream-online", {
      broadcasterUserId: event.broadcaster_user_id,
    });
    return;
  }

  const video_id = video.data.find((v) => v.stream_id === stream.id)?.id;

  if (!video_id) {
    reportError(new Error("stream.online: vod not found"), "eventsub.stream-online", {
      broadcasterUserId: event.broadcaster_user_id,
      streamId: stream.id,
    });
    return;
  }

  await insertVod(supabase, {
    broadcaster_id: stream.user_id,
    video_id: video_id,
    stream_id: stream.id,
    started_at: stream.started_at,
  });

  // update the database with the stream online event
  await upsertBroadcasterLiveStatus(supabase, {
    broadcaster_id: stream.user_id,
    broadcaster_name: stream.user_name,
    is_live: true,
    stream_started_at: stream.started_at,
    title: stream.title,
    stream_id: stream.id,
    category_id: stream.game_id,
    category_name: stream.game_name,
  });

  // Stamp any already-connected GPS overlay room with the new stream_id.
  // Must run after insertVod — irl_geo_track.stream_id is an FK onto vods.
  await notifyStreamStatus(stream.user_id, stream.id);

  // Durable copy for overlays that were NOT connected when this fired.
  await setStreamUserState(stream.user_id, { id: stream.id, startedAt: stream.started_at });

  await streamEventsLogger.logTwitchEvent({
    broadcaster_id: stream.user_id,
    event_type: "stream.online",
    event_data: event,
    metadata: null,
  });

  // Start polling viewer counts for this stream
  viewerCountPoller.startPolling(stream.user_id, stream.id);
};
