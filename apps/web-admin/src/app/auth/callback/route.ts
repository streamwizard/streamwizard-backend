import { NextResponse, type NextRequest } from "next/server";
import { createRouteHandlerClient } from "@repo/supabase/next/server";

// Relative Location headers are resolved by the browser against the origin it
// is already on, so redirects stay same-origin by construction — no need to
// reconstruct our own origin from config or (spoofable) Host headers.
// NextResponse.redirect() only accepts absolute URLs, hence the manual 307.
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // Supabase/Twitch hand back ?error=... when the user denies consent or the
  // provider itself fails — surface it instead of a bare code check.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");

  if (providerError) {
    console.error("[web-admin] OAuth provider returned an error:", providerError);
    return redirectTo("/login?error=oauth_failed");
  }

  if (!code) {
    console.error("[web-admin] Auth callback reached with no ?code param");
    return redirectTo("/login?error=oauth_failed");
  }

  // Build the success response up front so the session cookies land directly
  // on the redirect we return. Writing them via next/headers cookies() and
  // returning a separately-constructed response dropped the Set-Cookie behind
  // the staging proxy, so the dashboard gate saw "Auth session missing!".
  const response = redirectTo("/ws");
  const supabase = createRouteHandlerClient(request, response);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[web-admin] exchangeCodeForSession failed:", error.message);
    return redirectTo("/login?error=oauth_failed");
  }

  // Exchange can succeed yet leave no persisted session if the Supabase client
  // is misconfigured (e.g. an empty NEXT_PUBLIC_SUPABASE_URL) — catch it here
  // so it doesn't look like a silent bounce off the dashboard layout.
  if (!data.session) {
    console.error("[web-admin] Code exchanged but no session was returned");
    return redirectTo("/login?error=session_failed");
  }

  return response;
}
