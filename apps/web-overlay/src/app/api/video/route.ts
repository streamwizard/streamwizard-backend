import { NextRequest } from "next/server";
import { isValidVideoProxySignature } from "@/lib/video-proxy-signature";
import { reportError } from "@repo/sentry";

// This proxy exists so OBS can play Twitch's signed clip MP4s (see
// getSignedClipProxyUrl). Without a check this is an unauthenticated open
// proxy (SSRF into internal/metadata endpoints, plus free bandwidth for
// anyone). The url param must carry an unexpired HMAC this server issued,
// so the only reachable upstreams are ones we chose. https-only on top of
// that, so a signed link can never be downgraded to another scheme.

const MAX_REDIRECTS = 3;

/**
 * In the overlay editor the browser fetches these clip URLs directly and they
 * play fine. Here the *server* fetches them, and a bare server-side request —
 * no User-Agent, no Referer, from a datacenter IP — is the shape Twitch's CDN
 * answers with 503. Present the request the way the browser that would
 * otherwise be making it does.
 */
const UPSTREAM_BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.twitch.tv/",
  Origin: "https://www.twitch.tv",
};

/** Registrable-ish domain: the last two labels, e.g. `cloudfront.net`. */
function baseDomain(hostname: string): string {
  return hostname.split(".").slice(-2).join(".");
}

/**
 * Only the first URL carries our signature, so letting fetch() follow
 * redirects blindly would hand an upstream the ability to point us anywhere —
 * the SSRF the signature closes, reopened one hop later. Each hop must stay
 * https and within the signed URL's own domain; anything else is refused.
 */
async function fetchWithCheckedRedirects(
  signedUrl: string,
  headers: Record<string, string>
): Promise<Response | null> {
  const allowedDomain = baseDomain(new URL(signedUrl).hostname);
  let current = signedUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, { headers, redirect: "manual" });

    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      return response;
    }

    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      return null;
    }
    if (next.protocol !== "https:" || baseDomain(next.hostname) !== allowedDomain) {
      return null;
    }
    current = next.toString();
  }

  return null;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new Response("Missing url parameter", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response("Invalid url parameter", { status: 400 });
  }
  if (parsed.protocol !== "https:") {
    return new Response("Upstream must be https", { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  if (!isValidVideoProxySignature(url, searchParams.get("exp"), searchParams.get("sig"))) {
    return new Response("Invalid or expired proxy signature", { status: 403 });
  }

  const headers: Record<string, string> = { ...UPSTREAM_BROWSER_HEADERS };
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    headers["Range"] = rangeHeader;
  }

  let upstream: Response | null;
  try {
    upstream = await fetchWithCheckedRedirects(url, headers);
  } catch (err) {
    // DNS, TLS, timeout, blocked egress. Without this the rejection escapes the
    // route and surfaces as an opaque platform error with nothing logged —
    // indistinguishable from the upstream simply refusing us.
    reportError(err, "api/video.upstreamFetch");
    return new Response("Could not reach upstream", { status: 502 });
  }

  if (!upstream) {
    return new Response("Upstream redirected off the signed host", { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    // Deliberately not mirroring the upstream status: a 503 from the CDN echoed
    // verbatim reads as "the overlay is down" in the browser and in uptime
    // checks. We are a gateway, so upstream failures are 502 with the real
    // status in the body and in Sentry.
    reportError(
      new Error(`Clip upstream responded ${upstream.status} for ${parsed.hostname}`),
      "api/video.upstreamStatus"
    );
    return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
  }

  const responseHeaders = new Headers({
    "Content-Type": "video/mp4",
    "Cache-Control": "no-store",
  });

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    responseHeaders.set("Content-Length", contentLength);
  }

  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) {
    responseHeaders.set("Accept-Ranges", acceptRanges);
  }

  const contentRange = upstream.headers.get("content-range");
  if (contentRange) {
    responseHeaders.set("Content-Range", contentRange);
  }

  return new Response(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers: responseHeaders,
  });
}
