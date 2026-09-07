import { supabase } from "@repo/supabase";
import { upsertBroadcasterLiveStatus } from "@repo/supabase/queries/live-status";
import { getTwitchIntegrationByBroadcasterId, getUserPreferencesByUserId } from "@repo/supabase/queries/user";
import type { TwitchApi } from "@repo/twitch-api";
import type { StreamOfflineEvent } from "@repo/schemas";
import { syncTwitch } from "../sync-twitch";
import { streamEventsLogger } from "@repo/logger";
import { viewerCountPoller } from "../../services/viewer-count-poller";
import { notifyStreamStatus } from "../../lib/ws-server";
import { setStreamUserState } from "../../lib/user-state";

export const handleStreamOffline = async (event: StreamOfflineEvent, TwitchAPI: TwitchApi) => {
  // Stop polling viewer counts for this broadcaster
  viewerCountPoller.stopPolling(event.broadcaster_user_id);

  // update the database with the stream offline event
  await upsertBroadcasterLiveStatus(supabase, {
    broadcaster_id: event.broadcaster_user_id,
    is_live: false,
    broadcaster_name: event.broadcaster_user_name,
  });

  // Clear stream_id on a still-connected GPS overlay room so fixes logged
  // after the stream ends aren't attributed to it.
  await notifyStreamStatus(event.broadcaster_user_id, null);
  await setStreamUserState(event.broadcaster_user_id, null);

  // log the stream offline event
  await streamEventsLogger.logTwitchEvent({
    broadcaster_id: event.broadcaster_user_id,
    event_type: "stream.offline",
    event_data: event,
    metadata: null,
  });

  const { data: user, error: userError } = await getTwitchIntegrationByBroadcasterId(supabase, event.broadcaster_user_id);

  if (userError || !user) throw new Error("User not found");

  // check the user preferences if they want to sync twitch clips when the stream goes offline
  const preferences = await getUserPreferencesByUserId(supabase, user.user_id);

  if (!preferences) throw new Error("Preferences not found");

  if (!preferences.sync_clips_on_end) return;

  // Use the reusable syncTwitch function
  await syncTwitch(event.broadcaster_user_id, TwitchAPI);
};
