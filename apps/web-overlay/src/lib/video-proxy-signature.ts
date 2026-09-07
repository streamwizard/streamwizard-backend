import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * The clip proxy (`/api/video`) may only fetch URLs this server handed out.
 * A host allowlist cannot express that: Twitch serves signed clip MP4s from
 * CloudFront distributions whose IDs are not stable, so any allowlist wide
 * enough to keep working (`*.cloudfront.net`) also turns the route into a
 * proxy for every other tenant on that CDN. Instead the server signs the
 * exact upstream URL and the route verifies the signature.
 */

const SIGNATURE_LABEL = "streamwizard/video-proxy/v1";

// Twitch's own signed URLs are short-lived; the proxy grant should not outlive
// them by much. Keeps a leaked link from being replayed indefinitely.
const TTL_SECONDS = 60 * 60;

function signingKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  // Derive a proxy-specific subkey rather than signing with the token
  // encryption key directly, so the two uses stay cryptographically separate.
  return createHash("sha256").update(`${SIGNATURE_LABEL}:${secret}`).digest();
}

function signature(url: string, expiresAt: number): string {
  return createHmac("sha256", signingKey())
    .update(`${expiresAt}\n${url}`)
    .digest("hex");
}

/** Proxy path for an upstream URL, signed so only we can mint it. */
export function signVideoProxyUrl(upstreamUrl: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const params = new URLSearchParams({
    url: upstreamUrl,
    exp: String(expiresAt),
    sig: signature(upstreamUrl, expiresAt),
  });
  return `/api/video?${params.toString()}`;
}

export function isValidVideoProxySignature(
  upstreamUrl: string,
  exp: string | null,
  sig: string | null
): boolean {
  if (!exp || !sig) return false;

  const expiresAt = Number(exp);
  if (!Number.isSafeInteger(expiresAt)) return false;
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false;

  const expected = Buffer.from(signature(upstreamUrl, expiresAt), "utf8");
  const provided = Buffer.from(sig, "utf8");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
