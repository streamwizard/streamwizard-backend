import { supabaseAdmin } from "@repo/supabase/next/admin";
import { createUserStateService } from "@repo/user-state";
import type { UserStateUpdatePayload } from "@repo/types";
import { broadcastToUser } from "@repo/ws-client";
import { env } from "./env";

/**
 * The widget route's user-state service. Web-overlay holds no bot socket, so
 * pushes go over ws-server's /internal/broadcast HTTP endpoint — the same
 * server-to-server path rest-api uses for stream-status. Best-effort by
 * design (the service already treats broadcast failures as log-and-continue);
 * unconfigured CONSUMER_SECRET simply means no live push.
 */
async function broadcastUserState(userId: string, payload: UserStateUpdatePayload): Promise<void> {
  const result = await broadcastToUser(userId, "streamwizard.user_state", payload, {
    wsServerUrl: env.WS_SERVER_URL,
    consumerSecret: env.CONSUMER_SECRET,
  });
  if (result.ok || result.reason === "unconfigured") return;
  if (result.reason === "status") throw new Error(`internal/broadcast responded ${result.status}`);
  throw result.error;
}

export const userStateService = createUserStateService({
  client: supabaseAdmin,
  broadcast: broadcastUserState,
});
