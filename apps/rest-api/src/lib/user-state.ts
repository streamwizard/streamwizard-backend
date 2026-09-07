import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getTwitchIntegrationByBroadcasterId } from "@repo/supabase/queries/user";
import { createUserStateService } from "@repo/user-state";
import { postInternalBroadcast } from "./ws-server";

/**
 * Records stream lifecycle into user_states. This webhook is the ONLY place
 * stream.online/offline arrives — the bot's conduit is not subscribed to
 * them — so this app alone owns the sys.* stream keys and the reset-on-stream
 * pass. A second writer with its own notion of the current stream would race
 * this one; don't add one.
 *
 * Best-effort. A failure here must never fail the EventSub handler; the widget
 * treats an unknown stream id as "restore what you had", so the worst case is
 * the behaviour we had before this existed.
 */
export const userStateService = createUserStateService({
  client: supabase,
  broadcast: (userId, payload) =>
    postInternalBroadcast(userId, "streamwizard.user_state", payload),
});

export async function setStreamUserState(
  broadcasterId: string,
  stream: { id: string; startedAt: string } | null
): Promise<void> {
  try {
    const { data } = await getTwitchIntegrationByBroadcasterId(supabase, broadcasterId);
    if (!data?.user_id) return;

    // Reset-on-stream policies run before the new sys.* keys land: the crash
    // guard reads the OLD sys.stream_ended_at to tell a crash-restart apart
    // from a genuinely new stream.
    if (stream !== null) {
      await userStateService.resetStreamStates(data.user_id);
    }

    await userStateService.setMany(data.user_id, [
      { key: "sys.stream_id", value: stream?.id ?? null },
      { key: "sys.stream_started_at", value: stream?.startedAt ?? null },
      { key: "sys.is_live", value: stream !== null },
      // Offline stamps the crash-guard clock; online leaves the previous
      // stamp in place (harmless once the reset above has consumed it).
      ...(stream === null
        ? [{ key: "sys.stream_ended_at", value: new Date().toISOString() }]
        : []),
    ]);
  } catch (error) {
    reportError(error, "user-state.stream-lifecycle-write", { broadcasterId, streamId: stream?.id ?? null });
  }
}
