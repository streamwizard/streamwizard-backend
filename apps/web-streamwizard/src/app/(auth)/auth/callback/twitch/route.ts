import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@repo/supabase/next/server";
import checkEventSubscriptions from "@/server/twitch/eventsub/check-event-subscriptions";
import { encryptToken } from "@repo/supabase/crypto";
import { updateTwitchTokens } from "@repo/supabase/queries/user";
import { captureServerEvent } from "@repo/posthog/server";
import { reportError } from "@repo/sentry";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const isLocalEnv = process.env.NODE_ENV === "development";

  // Use the configured base URL in production to prevent x-forwarded-host spoofing
  const origin = isLocalEnv
    ? requestUrl.origin
    : (process.env.NEXT_PUBLIC_BASE_URL ?? requestUrl.origin);

  const code = searchParams.get("code");
  // Sanitize next to a relative path only to prevent open redirect
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("://")
      ? rawNext
      : "/dashboard";

  const oauthError = searchParams.get("error");
  const oauthErrorCode = searchParams.get("error_code");
  const oauthErrorDescription = searchParams.get("error_description");

  const errorRedirect = (reason: string) =>
    NextResponse.redirect(`${origin}/auth/auth-code-error?provider=twitch&reason=${reason}`);

  if (oauthError) {
    console.error("[twitch callback] OAuth provider returned an error", {
      error: oauthError,
      error_code: oauthErrorCode,
      error_description: oauthErrorDescription,
    });
  }

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data) {
      console.error("[twitch callback] exchangeCodeForSession failed", {
        message: error?.message,
        status: error?.status,
        code: error?.code,
      });
      return errorRedirect("exchange_failed");
    }

    if (
      !data.session?.provider_token ||
      !data.session?.provider_refresh_token
    ) {
      console.error("[twitch callback] missing provider tokens on session", {
        hasProviderToken: !!data.session?.provider_token,
        hasProviderRefreshToken: !!data.session?.provider_refresh_token,
        userId: data.session?.user?.id,
      });
      return errorRedirect("missing_tokens");
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(data.session.provider_token);
    const encryptedRefreshToken = encryptToken(
      data.session.provider_refresh_token,
    );

    const { error: err } = await updateTwitchTokens(
      supabase,
      data.session.user.id,
      {
        access_token_ciphertext: encryptedAccessToken.ciphertext,
        access_token_iv: encryptedAccessToken.iv,
        access_token_tag: encryptedAccessToken.authTag,
        refresh_token_ciphertext: encryptedRefreshToken.ciphertext,
        refresh_token_iv: encryptedRefreshToken.iv,
        refresh_token_tag: encryptedRefreshToken.authTag,
      },
    );

    if (err) {
      console.error("[twitch callback] updateTwitchTokens failed", err);
      return errorRedirect("token_save_failed");
    }

    await checkEventSubscriptions(data.session.user.user_metadata.sub);
    if (!error) {
      // The other side of `login_clicked`: without this the OAuth funnel has a
      // click and then silence, and drop-off at Twitch is invisible.
      try {
        captureServerEvent(data.session.user.id, "login_completed", {
          destination: next.includes("onboarding") ? "onboarding" : "dashboard",
        });
      } catch (phErr) {
        reportError(phErr, "auth/callback/twitch: posthog capture failed");
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (oauthError) {
    return errorRedirect(oauthError === "access_denied" ? "access_denied" : "provider_error");
  }

  console.error("[twitch callback] no code and no error param on request", {
    url: requestUrl.toString(),
  });

  // return the user to an error page with instructions
  return errorRedirect("missing_code");
}
