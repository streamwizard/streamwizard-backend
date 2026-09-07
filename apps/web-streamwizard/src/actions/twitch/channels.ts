"use server";

import { TwitchApi, type ChannelInformation } from "@repo/twitch-api";
import { createClient } from "@repo/supabase/next/server";
import { getTwitchUserId } from "@repo/supabase/queries/user";
import { reportError } from "@repo/sentry";

/**
 * Reading and writing the signed-in streamer's own channel info.
 *
 * The broadcaster id comes from the session's Twitch integration and is never
 * taken from the caller — an id in the argument list is an id a client can
 * change, which would turn this into a way to rewrite other people's titles.
 */

// Twitch rejects a longer title outright; checked here so the deck can say so
// rather than surfacing an opaque 400 on a phone.
const MAX_TITLE_LENGTH = 140;

export interface ChannelInfoResult {
  ok: boolean;
  info?: ChannelInformation;
  /**
   * Box art for `info.game_id`, which `GET /channels` doesn't return.
   *
   * Resolved here rather than by the client so opening the tab costs one round
   * trip from the phone instead of two chained ones. Still a Helix template
   * with `{width}`/`{height}` in it — the caller picks the size it renders at.
   */
  boxArtUrl?: string;
  error?: string;
}

export async function getMyChannelInfo(): Promise<ChannelInfoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const twitchUserId = await getTwitchUserId(supabase);
  if (!twitchUserId) return { ok: false, error: "Connect your Twitch account first" };

  try {
    const api = new TwitchApi(twitchUserId);
    const info = await api.channels.getChannelInformation(twitchUserId);
    if (!info) return { ok: false, error: "Twitch didn't return your channel" };

    // A channel with no category set has no art to fetch, and a lookup that
    // fails shouldn't cost the streamer their title — the picker falls back to
    // a placeholder on its own.
    let boxArtUrl: string | undefined;
    if (info.game_id) {
      try {
        boxArtUrl = (await api.search.lookupGame(info.game_id))?.box_art_url;
      } catch (error) {
        reportError(error, "getMyChannelInfo:boxArt");
      }
    }

    return { ok: true, info, boxArtUrl };
  } catch (error) {
    reportError(error, "getMyChannelInfo");
    return { ok: false, error: "Couldn't load your channel info" };
  }
}

export interface UpdateChannelInfoResult {
  ok: boolean;
  error?: string;
}

export async function updateChannelInfo(params: {
  title?: string;
  gameId?: string;
}): Promise<UpdateChannelInfoResult> {
  const title = params.title?.trim();
  if (title !== undefined && title.length === 0) {
    return { ok: false, error: "A stream needs a title" };
  }
  if (title !== undefined && title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `Titles are capped at ${MAX_TITLE_LENGTH} characters` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const twitchUserId = await getTwitchUserId(supabase);
  if (!twitchUserId) return { ok: false, error: "Connect your Twitch account first" };

  try {
    const api = new TwitchApi(twitchUserId);
    await api.channels.updateChannelInfo(twitchUserId, {
      title,
      game_id: params.gameId,
    });
    return { ok: true };
  } catch (error) {
    reportError(error, "updateChannelInfo");
    return { ok: false, error: "Twitch wouldn't accept that change" };
  }
}
