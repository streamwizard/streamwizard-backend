import { updateSession } from "@repo/supabase/next/proxy";
import { type NextRequest } from "next/server";
import { buildCsp } from "@/lib/csp";

export async function proxy(request: NextRequest) {
  // Per-request nonce'd CSP. The header must be on the *request* before
  // updateSession builds its pass-through response (Next reads the nonce from
  // the forwarded request header to tag its inline scripts) and on the
  // *response* (so the browser enforces it). A static header without a nonce
  // would need script-src 'unsafe-inline', defeating CSP's XSS protection.
  const nonce = btoa(crypto.randomUUID());
  // Only the widget editor loads Monaco, which needs the policy's weakest
  // directives ('unsafe-eval' and worker-src). Grant them just there so every
  // other page — including public marketing/legal routes — runs the tighter
  // policy.
  const needsMonaco = request.nextUrl.pathname.startsWith("/dashboard/widgets/");
  // Only staging sits behind Cloudflare Access — see the cloudflareAccess
  // option doc in csp.ts for why this needs its own manifest-src carve-out.
  // NODE_ENV is "staging" there (see src/lib/env.ts), which the built-in
  // NodeJS.ProcessEnv type doesn't know about, hence the cast.
  const cloudflareAccess = (process.env.NODE_ENV as string) === "staging";
  const csp = buildCsp(nonce, { monaco: needsMonaco, cloudflareAccess });
  request.headers.set("content-security-policy", csp);
  // Next reads the nonce from the CSP header above for its own inline scripts,
  // but libraries that inject their own inline <script> (next-themes' anti-flash
  // script) can't see it. Expose it as a plain header so the root layout can
  // read it via headers() and forward it to those providers.
  request.headers.set("x-nonce", nonce);

  const response = await updateSession(request);
  // In dev the policy is report-only: nothing is blocked (local test nodes and
  // Supabase run on plain http/ws), but violations still log to the browser
  // console so missing directives surface before staging. The *request* header
  // above must keep the enforcing name either way — Next reads the nonce from it.
  const responseHeader =
    process.env.NODE_ENV === "development" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
  response.headers.set(responseHeader, csp);
  return response;
}

// txt/xml are listed so /robots.txt and /sitemap.xml skip updateSession: they are
// crawler-facing and have no session to refresh.
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)).*)",
    "/(api|trpc)(.*)",
  ],
};
