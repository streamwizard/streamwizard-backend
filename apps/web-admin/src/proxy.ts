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
  const csp = buildCsp(nonce);
  request.headers.set("content-security-policy", csp);

  const response = await updateSession(request);
  // In dev the policy is report-only: nothing is blocked (local Supabase and
  // ws-server run on plain http/ws), but violations still log to the browser
  // console so missing directives surface before staging. The *request* header
  // above must keep the enforcing name either way — Next reads the nonce from it.
  const responseHeader =
    process.env.NODE_ENV === "development" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
  response.headers.set(responseHeader, csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
