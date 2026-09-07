import { supabase } from "@repo/supabase";
import { decryptToken, encryptToken } from "@repo/supabase/crypto";
import { getTwitchIntegration, updateTwitchTokens } from "@repo/supabase/queries/obs-nodes";
import { env } from "./env";

/**
 * Fetching a user's Twitch stream key on behalf of a node, refreshing the
 * stored OAuth token when Twitch says it's expired.
 *
 * Tokens are stored encrypted (AES-256-GCM) in `integrations_twitch`; the
 * encrypt/decrypt pair lives in `@repo/supabase/crypto`, which reads the same
 * TOKEN_ENCRYPTION_KEY this app validates at boot.
 */

async function fetchTwitchStreamKey(twitchUserId: string, accessToken: string): Promise<string> {
  const res = await fetch(`https://api.twitch.tv/helix/streams/key?broadcaster_id=${twitchUserId}`, {
    headers: {
      "Client-Id": env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`Twitch API error ${res.status}: ${body}`), { status: res.status });
  }

  const json = (await res.json()) as { data: { stream_key: string }[] };
  const key = json.data[0]?.stream_key;
  if (!key) throw new Error("No stream key returned by Twitch API");
  return key;
}

/** Exchanges the refresh token, stores the new pair, and returns the access token. */
async function refreshTwitchToken(userId: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Token refresh failed ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { access_token: string; refresh_token: string };

  const encAccess = encryptToken(data.access_token);
  const encRefresh = encryptToken(data.refresh_token);

  await updateTwitchTokens(supabase, userId, {
    access_token_ciphertext: encAccess.ciphertext,
    access_token_iv: encAccess.iv,
    access_token_tag: encAccess.authTag,
    refresh_token_ciphertext: encRefresh.ciphertext,
    refresh_token_iv: encRefresh.iv,
    refresh_token_tag: encRefresh.authTag,
  });

  return data.access_token;
}

/**
 * The user's current stream key, or null when there's no Twitch integration or
 * the lookup failed — non-fatal, OBS then shows its "Enter Stream Key" screen.
 */
export async function getStreamKeyForUser(userId: string): Promise<string | null> {
  try {
    const integration = await getTwitchIntegration(supabase, userId);
    if (!integration) return null;

    const {
      twitch_user_id,
      access_token_ciphertext,
      access_token_iv,
      access_token_tag,
      refresh_token_ciphertext,
      refresh_token_iv,
      refresh_token_tag,
    } = integration;

    if (
      !access_token_ciphertext ||
      !access_token_iv ||
      !access_token_tag ||
      !refresh_token_ciphertext ||
      !refresh_token_iv ||
      !refresh_token_tag
    ) {
      return null;
    }

    const accessToken = decryptToken(access_token_ciphertext, access_token_iv, access_token_tag);

    try {
      return await fetchTwitchStreamKey(twitch_user_id, accessToken);
    } catch (err) {
      if ((err as { status?: number })?.status !== 401) throw err;

      console.log("[nodes] Twitch access token expired, refreshing", { userId });
      const refreshToken = decryptToken(
        refresh_token_ciphertext,
        refresh_token_iv,
        refresh_token_tag,
      );
      const refreshed = await refreshTwitchToken(userId, refreshToken);
      return await fetchTwitchStreamKey(twitch_user_id, refreshed);
    }
  } catch (err) {
    console.warn("[nodes] failed to fetch Twitch stream key", {
      userId,
      error: (err as Error).message,
    });
    return null;
  }
}
