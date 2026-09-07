import { NextResponse } from "next/server";

import { createClient } from "@repo/supabase/next/server";
import { reportError } from "@repo/sentry";

export async function GET(request: Request) {
  // Same origin handling as the callback routes: behind the proxy the
  // standalone server sees an internal Host (e.g. 0.0.0.0:3000), which both
  // breaks the redirects and makes Supabase reject redirectTo as not
  // allowlisted. Only trust the request origin in local dev.
  const requestUrl = new URL(request.url);
  const origin =
    process.env.NODE_ENV === "development"
      ? requestUrl.origin
      : (process.env.NEXT_PUBLIC_BASE_URL ?? requestUrl.origin);
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent("/auth/link/discord")}`);
  }

  const { error, data } = await supabase.auth.linkIdentity({
    provider: "discord",
    options: {
      redirectTo: `${origin}/auth/callback/discord`,
      // The Verified Member role is granted directly by the bot once we have
      // the user's Discord ID, so we only need enough scope to link the identity.
      scopes: "identify",
    },
  });

  if (error) {
    reportError(error, "auth/link/discord: linkIdentity failed");
    return NextResponse.redirect(`${origin}/error?code=discord_link`);
  }

  return NextResponse.redirect(data.url);
}
