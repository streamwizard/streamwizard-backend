import { supabase } from "@repo/supabase";
import { TwitchApi } from "@repo/twitch-api";

const SYNC_INTERVAL_MS = 60 * 60 * 1000;

async function getBroadcasters() {
  const { data, error } = await supabase.from("integrations_twitch").select("twitch_user_id, user_id");

  if (error) throw error;
  return data ?? [];
}

async function syncClipsForBroadcaster(broadcasterId: string, userId: string, twitchApi: TwitchApi) {
  const since = new Date(Date.now() - SYNC_INTERVAL_MS - 5 * 60 * 1000).toISOString();

  const res = await twitchApi.clips.getClips({
    broadcaster_id: broadcasterId,
    started_at: since,
  });

  if (!res?.data?.length) {
    console.log(`[hourly-sync] [${broadcasterId}] No new clips`);
    return 0;
  }

  const { error } = await supabase.from("clips").upsert(
    res.data.map((clip) => ({
      twitch_clip_id: clip.id,
      broadcaster_id: clip.broadcaster_id,
      broadcaster_name: clip.broadcaster_name,
      creator_id: clip.creator_id,
      creator_name: clip.creator_name,
      title: clip.title,
      url: clip.url,
      embed_url: clip.embed_url,
      thumbnail_url: clip.thumbnail_url,
      view_count: clip.view_count,
      duration: clip.duration,
      vod_offset: clip.vod_offset,
      created_at_twitch: clip.created_at,
      video_id: clip.video_id,
      game_id: clip.game_id,
      language: clip.language,
      user_id: userId,
    })),
    { onConflict: "twitch_clip_id" },
  );

  if (error) throw error;
  console.log(`[hourly-sync] [${broadcasterId}] Synced ${res.data.length} clips`);
  return res.data.length;
}

async function runSync(twitchApi: TwitchApi) {
  console.log("[hourly-sync] Starting sync...");

  const broadcasters = await getBroadcasters();
  console.log(`[hourly-sync] Syncing ${broadcasters.length} broadcasters`);

  const results = await Promise.allSettled(broadcasters.map((b) => syncClipsForBroadcaster(b.twitch_user_id, b.user_id, twitchApi)));

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const broadcasterId = broadcasters[i]?.twitch_user_id ?? `index ${i}`;
      console.error(`[hourly-sync] [${broadcasterId}] Failed:`, result.reason);
    }
  });

  console.log(`[hourly-sync] Done — ${succeeded} succeeded, ${failed} failed`);
}

export async function runHourlySync(twitchApi: TwitchApi, isRunning: () => boolean) {
  while (isRunning()) {
    try {
      await runSync(twitchApi);
    } catch (err) {
      console.error("[hourly-sync] Error:", err);
    }

    await new Promise((r) => setTimeout(r, SYNC_INTERVAL_MS));
  }

  console.log("[hourly-sync] Stopped");
}
