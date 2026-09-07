import "server-only";
import { unstable_cache } from "next/cache";
import { env } from "@/lib/env";

/*
 * Category names for public pages. Clip rows carry game_id but not game_name
 * (the dashboard resolves names through the Twitch API), and the landing page
 * has no logged-in user to borrow a token from, so this takes the app route:
 * a client-credentials token straight from Twitch, no app-token table and no
 * service-role client involved.
 *
 * Category names effectively never change, so the map is cached for a day. Any
 * failure resolves to an empty map: callers treat a missing name as "no
 * category" rather than blocking the page on Twitch being up.
 */

const HELIX_GAMES_LIMIT = 100;

async function fetchAppToken(): Promise<string | null> {
  try {
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (error) {
    console.error("[twitch-games] app token failed", error);
    return null;
  }
}

async function fetchGameNames(gameIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(gameIds.filter(Boolean))].slice(0, HELIX_GAMES_LIMIT);
  if (ids.length === 0) return {};

  const token = await fetchAppToken();
  if (!token) return {};

  try {
    const params = new URLSearchParams();
    for (const id of ids) params.append("id", id);

    const response = await fetch(`https://api.twitch.tv/helix/games?${params}`, {
      headers: {
        "Client-Id": env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return {};

    const body = (await response.json()) as { data?: { id: string; name: string }[] };
    return Object.fromEntries((body.data ?? []).map((game) => [game.id, game.name]));
  } catch (error) {
    console.error("[twitch-games] lookup failed", error);
    return {};
  }
}

/** id → category name, for the ids Twitch knows. Unknown ids are absent. */
export async function getGameNames(gameIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(gameIds.filter(Boolean))].sort();
  if (ids.length === 0) return {};

  /* The id list is part of the cache key: a different set of clips looks up a
   * different set of categories. */
  return unstable_cache(() => fetchGameNames(ids), ["twitch-game-names", ids.join(",")], {
    revalidate: 60 * 60 * 24,
  })();
}
