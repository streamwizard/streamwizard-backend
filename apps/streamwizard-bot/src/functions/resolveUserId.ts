import { supabase } from "@repo/supabase";
import { getTwitchIntegrationByBroadcasterId } from "@repo/supabase/queries/user";

/**
 * broadcaster_user_id (Twitch) → supabase user_id.
 *
 * Cached because it sits on the path of every single EventSub event, chat
 * included, and the mapping almost never changes. The TTL is what keeps
 * "almost" honest: a streamer who reconnects Twitch under a different account
 * would otherwise keep the stale mapping until the process restarts, and a
 * mis-mapping now writes state to the wrong user's row rather than merely
 * misrouting an overlay event.
 */
const TTL_MS = 10 * 60 * 1000;

const cache = new Map<string, { userId: string; expiresAt: number }>();

export async function resolveUserId(broadcasterId: string): Promise<string | null> {
  const cached = cache.get(broadcasterId);
  if (cached && Date.now() < cached.expiresAt) return cached.userId;

  const { data } = await getTwitchIntegrationByBroadcasterId(supabase, broadcasterId);
  if (!data?.user_id) return null;

  cache.set(broadcasterId, { userId: data.user_id, expiresAt: Date.now() + TTL_MS });
  return data.user_id;
}
