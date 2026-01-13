import { type Context, type Next } from "hono";
import {
  getTwitchHeader,
  TWITCH_MESSAGE_ID,
  TWITCH_MESSAGE_TIMESTAMP,
  TWITCH_MESSAGE_SIGNATURE,
  TWITCH_MESSAGE_TYPE,
  verifySignature,
} from "../lib/twitch-eventsub";
import type { EventSubVerificationPayload, EventSubNotificationPayload, EventSubRevocationPayload } from "../types/twitch-eventsub";

/**
 * Twitch EventSub Webhook Verification Middleware
 *
 * Verifies that incoming requests are authentic Twitch EventSub webhooks
 * by validating required headers and verifying HMAC signatures.
 *
 * On success, attaches the parsed notification and message type to the context.
 * On failure, returns appropriate error responses.
 *
 * @see https://dev.twitch.tv/docs/eventsub/handling-webhook-events/
 */
export function twitchEventSubVerification() {
  return async (c: Context, next: Next) => {
    const headers = c.req.raw.headers;
    // Extract required headers (case-insensitive)
    const messageId = getTwitchHeader(headers, TWITCH_MESSAGE_ID);
    const timestamp = getTwitchHeader(headers, TWITCH_MESSAGE_TIMESTAMP);
    const signature = getTwitchHeader(headers, TWITCH_MESSAGE_SIGNATURE);
    const messageType = getTwitchHeader(headers, TWITCH_MESSAGE_TYPE);

    // Validate required headers
    if (!messageId || !timestamp || !signature || !messageType) {
      return c.json(
        {
          error: "Missing required headers",
          message: "Twitch EventSub webhook requires specific headers",
        },
        400
      );
    }

    // Get raw body for signature verification
    // Check if raw body was stored in context by raw body middleware, otherwise read from request
    let rawBody: string;
    const contextRawBody = c.get("rawBody");
    if (typeof contextRawBody === "string") {
      rawBody = contextRawBody;
    } else {
      // Clone request to avoid consuming the body
      const clonedRequest = c.req.raw.clone();
      rawBody = await clonedRequest.text();
    }

    // Verify signature before processing
    const isValid = verifySignature(messageId, timestamp, rawBody, signature);

    if (!isValid) {
      console.warn("Invalid Twitch EventSub signature", {
        messageId,
        timestamp,
      });
      return c.json(
        {
          error: "Invalid signature",
          message: "Request signature verification failed",
        },
        403
      );
    }

    // Parse the notification body
    let notification: EventSubVerificationPayload | EventSubNotificationPayload | EventSubRevocationPayload;
    try {
      notification = JSON.parse(rawBody);
    } catch (error) {
      return c.json(
        {
          error: "Invalid JSON",
          message: "Failed to parse notification body",
        },
        400
      );
    }

    // Attach verified notification and message type to context
    c.set("twitchNotification", notification);
    c.set("twitchMessageType", messageType);

    await next();
  };
}
