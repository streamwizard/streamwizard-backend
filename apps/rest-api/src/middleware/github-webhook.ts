import { type Context, type Next } from "hono";
import { verifyGithubSignature } from "@repo/github-api";
import { env } from "../lib/env";

const GITHUB_SIGNATURE_HEADER = "x-hub-signature-256";
const GITHUB_EVENT_HEADER = "x-github-event";

/**
 * GitHub Webhook Verification Middleware
 *
 * Verifies incoming GitHub App webhook deliveries by checking the
 * x-hub-signature-256 HMAC signature against the raw body.
 *
 * On success, attaches the parsed payload and event type to the context.
 * On failure, returns appropriate error responses.
 *
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export function githubWebhookVerification() {
  return async (c: Context, next: Next) => {
    const headers = c.req.raw.headers;
    const signature = headers.get(GITHUB_SIGNATURE_HEADER);
    const eventType = headers.get(GITHUB_EVENT_HEADER);

    if (!eventType) {
      return c.json({ error: "Missing required headers", message: "GitHub webhook requires x-github-event" }, 400);
    }

    let rawBody: string;
    const contextRawBody = c.get("rawBody");
    if (typeof contextRawBody === "string") {
      rawBody = contextRawBody;
    } else {
      const clonedRequest = c.req.raw.clone();
      rawBody = await clonedRequest.text();
    }

    const isValid = verifyGithubSignature(env.GITHUB_WEBHOOK_SECRET, rawBody, signature);
    if (!isValid) {
      console.warn("Invalid GitHub webhook signature", { eventType });
      return c.json({ error: "Invalid signature", message: "Request signature verification failed" }, 403);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "Invalid JSON", message: "Failed to parse webhook payload" }, 400);
    }

    c.set("githubPayload", payload);
    c.set("githubEventType", eventType);

    await next();
  };
}
