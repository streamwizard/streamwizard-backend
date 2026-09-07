import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

/**
 * Shared cache of Twitch asset lookups (badges, emotes, cheermotes) so every
 * process doesn't spend its own Helix budget on the same static data.
 */

type DBClient = SupabaseClient<Database>;

/** Rows past their expiry are filtered out server-side, so a hit is always fresh. */
export async function selectCachedAsset(client: DBClient, cacheKey: string) {
  return client
    .from("twitch_asset_cache")
    .select("payload, expires_at")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
}

export async function upsertCachedAsset(
  client: DBClient,
  entry: { cacheKey: string; payload: unknown; expiresAt: number },
) {
  return client.from("twitch_asset_cache").upsert(
    {
      cache_key: entry.cacheKey,
      payload: entry.payload as never,
      expires_at: new Date(entry.expiresAt).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );
}
