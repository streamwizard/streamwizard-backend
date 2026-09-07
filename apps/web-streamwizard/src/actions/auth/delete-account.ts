"use server";

import { reportError } from "@repo/sentry";

import { tryAuthContext } from "@/lib/auth";
import { getChannelAccessToken } from "@repo/supabase";
import { getDiscordIntegrationByUserId } from "@repo/supabase/queries/user";
import { getGuildSettings } from "@repo/supabase/queries/discord";
import { createAdminClient, supabaseAdmin } from "@repo/supabase/next/admin";
import { TwitchApi } from "@repo/twitch-api";
import { redirect } from "next/navigation";
import axios from "axios";
import { removeRole } from "@/server/discord/roles";
import { env } from "@/lib/env";

export async function deleteAccount() {
  const ctx = await tryAuthContext();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { user, broadcasterId } = ctx;
  const supabase = createAdminClient();
  // Revoke the Twitch access token so it is immediately invalidated.
  // This cannot remove the app from the user's Twitch authorized connections
  // UI — they must do that manually from Twitch Settings → Connections.
  try {
    const accessToken = await getChannelAccessToken(broadcasterId);
    await axios.post(
      "https://id.twitch.tv/oauth2/revoke",
      new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID!,
        token: accessToken,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
  } catch {
    // Non-fatal: token may already be expired; proceed with deletion.
  }

  // Delete all EventSub subscriptions for this broadcaster. Twitch changes
  // their status to authorization_revoked but does NOT delete them — they
  // keep counting against quota until explicitly removed.
  try {
    const eventsub = new TwitchApi().eventsub;
    const { data: subscriptions } =
      await eventsub.getSubscriptions(broadcasterId);
    await Promise.all(
      subscriptions.map((sub) =>
        eventsub.deleteSubscription(sub.id, broadcasterId),
      ),
    );
  } catch {
    // Non-fatal: proceed with data deletion even if cleanup fails.
  }

  // Best-effort: revoke the Verified Member role directly via the bot before
  // wiping the integration row, since deleting the account doesn't remove
  // the user from the Discord server itself. A failure here must not block
  // account deletion.
  try {
    const { data: integration } = await getDiscordIntegrationByUserId(supabase, user.id);
    const settings = await getGuildSettings(supabaseAdmin, env.DISCORD_GUILD_ID);
    if (integration?.discord_user_id && settings?.verified_role_id) {
      await removeRole(integration.discord_user_id, settings.verified_role_id);
    }
  } catch (revokeErr) {
    const { captureException } = await import("@sentry/nextjs");
    captureException(revokeErr);
  }

  const { error: rpcError } = await supabase.rpc("delete_user_data", {
    p_twitch_user_id: broadcasterId,
  });
  if (rpcError) {
    reportError(rpcError, "actions/delete-account");
    return { success: false, error: rpcError.message };
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
    user.id,
  );
  if (authError) {
    reportError(authError, "actions/delete-account");
    return { success: false, error: authError.message };
  }

  redirect("/goodbye");
}
