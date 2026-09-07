import { NextResponse } from "next/server";
import { createClient } from "@repo/supabase/next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { linkDiscordIntegration } from "@repo/supabase/queries/user";
import { getGuildSettings } from "@repo/supabase/queries/discord";
import { assignRole, DiscordMemberNotFoundError } from "@/server/discord/roles";
import { env } from "@/lib/env";
import { reportError } from "@repo/sentry";
import { captureServerEvent } from "@repo/posthog/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const isLocalEnv = process.env.NODE_ENV === "development";

  const origin = isLocalEnv
    ? requestUrl.origin
    : (process.env.NEXT_PUBLIC_BASE_URL ?? requestUrl.origin);

  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const rawNext = searchParams.get("next") ?? "/dashboard/settings/integrations";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("://")
      ? rawNext
      : "/dashboard/settings/integrations";

  const errorRedirect = (reason: string) =>
    NextResponse.redirect(`${origin}/auth/auth-code-error?provider=discord&reason=${reason}`);

  if (!code) {
    return errorRedirect(oauthError === "access_denied" ? "access_denied" : "missing_code");
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data) {
    return errorRedirect("exchange_failed");
  }

  const identityData = data.session.user.identities?.find((identity) => identity.provider === "discord")
    ?.identity_data;

  // Supabase normalizes Discord's profile into OIDC-ish claims, not Discord's own field
  // names: provider_id/sub (not user_id), full_name (not username), avatar_url (not avatar).
  if (!identityData?.provider_id || !identityData?.full_name) {
    return errorRedirect("missing_identity");
  }

  try {
    await linkDiscordIntegration(supabase, {
      discord_user_id: identityData.provider_id,
      discord_username: identityData.full_name,
      avatar: identityData.avatar_url ?? null,
      email: identityData.email ?? null,
    });
  } catch (err) {
    // Postgres unique violation (23505) on integrations_discord_discord_user_id_key
    // means this Discord account is already linked to a *different* StreamWizard
    // account — that's not a transient failure, so "try again" won't help.
    const pgError = err as { code?: string; message?: string };
    if (pgError.code === "23505" && pgError.message?.includes("discord_user_id")) {
      return errorRedirect("already_linked");
    }
    reportError(err, "auth/callback/discord: linkDiscordIntegration failed");
    return errorRedirect("link_failed");
  }

  // Best-effort: the account link already succeeded above, so a failed role
  // grant shouldn't block the connect itself — but report it so we notice
  // if the bot's permissions or role hierarchy regress. The one expected
  // failure is the user OAuth'ing before joining the server, which we
  // surface to them instead of just logging — the bot's guildMemberAdd
  // handler will retry the grant once they actually join.
  let roleStatus: "granted" | "pending_membership" | "failed" | "skipped" = "skipped";
  try {
    const settings = await getGuildSettings(supabaseAdmin, env.DISCORD_GUILD_ID);
    if (settings?.verified_role_id) {
      await assignRole(identityData.provider_id, settings.verified_role_id);
      roleStatus = "granted";
    } else {
      console.log(`[discord/callback] No verified_role_id configured for guild ${env.DISCORD_GUILD_ID}, skipping role grant.`);
    }
  } catch (roleErr) {
    if (roleErr instanceof DiscordMemberNotFoundError) {
      roleStatus = "pending_membership";
    } else {
      roleStatus = "failed";
      const { captureException } = await import("@sentry/nextjs");
      captureException(roleErr);
    }
  }

  try {
    captureServerEvent(data.session.user.id, "discord_linked", {
      role_status: roleStatus,
      source: next.includes("onboarding") ? "onboarding" : "settings",
    });
  } catch (phErr) {
    reportError(phErr, "auth/callback/discord: posthog capture failed");
  }

  const redirectUrl = new URL(`${origin}${next}`);
  if (roleStatus === "pending_membership" || roleStatus === "failed") {
    redirectUrl.searchParams.set("discordRole", roleStatus);
  }

  return NextResponse.redirect(redirectUrl);
}
