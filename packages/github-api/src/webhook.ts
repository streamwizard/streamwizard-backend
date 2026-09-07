import { createHmac, timingSafeEqual } from "node:crypto";

const HMAC_PREFIX = "sha256=";

// GitHub signs the raw request body directly (unlike Twitch, which also mixes
// in a message id + timestamp). Header is `x-hub-signature-256: sha256=<hex>`.
export function verifyGithubSignature(secret: string, rawBody: string, receivedSignature: string | null): boolean {
  if (!receivedSignature) return false;

  const expectedHmac = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedSignature = HMAC_PREFIX + expectedHmac;

  try {
    return timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature));
  } catch {
    // Different lengths throw rather than returning false.
    return false;
  }
}
