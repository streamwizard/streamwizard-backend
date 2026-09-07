"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@repo/supabase/next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { deleteDiscordIntegration, getDiscordIntegrationByUserId } from "@repo/supabase/queries/user";
import { getGuildSettings } from "@repo/supabase/queries/discord";
import { assignRole, DiscordMemberNotFoundError, removeRole } from "@/server/discord/roles";
import { env } from "@/lib/env";
import { reportAndRedirect } from "@/lib/report-redirect";

export async function linkDiscord(next?: string) {
  const supabase = await createClient();

  const headersList = await headers();
  const origin = headersList.get("origin");
  // Only relative, same-origin paths are allowed through — the callback
  // route re-validates this too, but reject early so we never embed an
  // attacker-controlled absolute/protocol-relative URL in the redirect chain.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.includes("://") ? next : undefined;
  const redirectTo = `${origin}/auth/callback/discord${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`;

  const { error, data } = await supabase.auth.linkIdentity({
    provider: "discord",
    options: {
      redirectTo,
      // The Verified Member role is granted directly by the bot (see
      // server/discord/roles.ts) once we have the user's Discord ID, so we
      // only need enough scope to link the identity.
      scopes: "identify",
    },
  });

  if (error) {
    reportAndRedirect(error, "/error?code=discord_link");
  }

  redirect(data.url);
}

// Re-grants the Verified Member role for an already-linked account, e.g. if
// it was removed manually or never landed (no OAuth needed — the role is
// assigned directly via the bot, see server/discord/roles.ts).
export async function reassignDiscordRole() {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    reportAndRedirect(userError ?? new Error("reassignDiscordRole: no user session"), "/error");
  }

  const { data: integration, error: integrationError } = await getDiscordIntegrationByUserId(
    supabase,
    userData.user.id
  );
  if (integrationError || !integration?.discord_user_id) {
    reportAndRedirect(integrationError ?? new Error("reassignDiscordRole: no linked Discord integration"), "/error");
  }

  const settings = await getGuildSettings(supabaseAdmin, env.DISCORD_GUILD_ID);
  if (settings?.verified_role_id) {
    try {
      await assignRole(integration.discord_user_id, settings.verified_role_id);
    } catch (roleErr) {
      if (roleErr instanceof DiscordMemberNotFoundError) {
        redirect("/dashboard/settings/integrations?discordRole=pending_membership");
      }
      const { captureException } = await import("@sentry/nextjs");
      captureException(roleErr);
      redirect("/dashboard/settings/integrations?discordRole=failed");
    }
  } else {
    console.log(`[discord/reassign] No verified_role_id configured for guild ${env.DISCORD_GUILD_ID}, skipping role grant.`);
  }

  revalidatePath("/dashboard/settings/integrations");
}

export async function unlinkDiscord() {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    reportAndRedirect(userError ?? new Error("unlinkDiscord: no user session"), "/error");
  }

  const { data: identitiesData, error: identitiesError } = await supabase.auth.getUserIdentities();
  if (identitiesError) {
    reportAndRedirect(identitiesError, "/error");
  }

  const discordIdentity = identitiesData.identities.find((identity) => identity.provider === "discord");

  // Supabase refuses to remove a user's last identity (you can't be left with
  // no way to log in), and throws if we try. Check up front instead of
  // attempting the unlink and bouncing the user to a generic error page.
  if (discordIdentity && identitiesData.identities.length <= 1) {
    redirect("/dashboard/settings/integrations?discordRole=unlink_blocked");
  }

  if (discordIdentity) {
    const { error: unlinkError } = await supabase.auth.unlinkIdentity(discordIdentity);
    if (unlinkError) {
      reportAndRedirect(unlinkError, "/error");
    }
  }

  // Best-effort: revoke the Verified Member role directly via the bot. A
  // failure here must not block the disconnect itself.
  try {
    const { data: integration } = await getDiscordIntegrationByUserId(supabase, userData.user.id);
    const settings = await getGuildSettings(supabaseAdmin, env.DISCORD_GUILD_ID);
    if (integration?.discord_user_id && settings?.verified_role_id) {
      await removeRole(integration.discord_user_id, settings.verified_role_id);
    } else {
      console.log(`[discord/unlink] No verified_role_id configured for guild ${env.DISCORD_GUILD_ID}, skipping role removal.`);
    }
  } catch (revokeErr) {
    const { captureException } = await import("@sentry/nextjs");
    captureException(revokeErr);
  }

  await deleteDiscordIntegration(supabase, userData.user.id);

  revalidatePath("/dashboard/settings/integrations");
}
