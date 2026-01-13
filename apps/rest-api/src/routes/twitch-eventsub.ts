import { type Context } from "hono";
import { MESSAGE_TYPE_VERIFICATION, MESSAGE_TYPE_NOTIFICATION, MESSAGE_TYPE_REVOCATION } from "../lib/twitch-eventsub";
import type { EventSubVerificationPayload, EventSubNotificationPayload, EventSubRevocationPayload } from "../types/twitch-eventsub";
import handleEventsub from "../function/handle-eventsub";


export async function handleTwitchEventSub(c: Context) {
  // Get verified notification and message type from context (set by middleware)
  const notification = c.get("twitchNotification") as EventSubVerificationPayload | EventSubNotificationPayload | EventSubRevocationPayload;
  const messageType = c.get("twitchMessageType") as string;

  if (!notification || !messageType) {
    return c.json(
      {
        error: "Internal error",
        message: "Notification data not found in context",
      },
      500
    );
  }

  // Handle different message types
  switch (messageType) {
    case MESSAGE_TYPE_VERIFICATION:
      return handleVerification(c, notification as EventSubVerificationPayload);

    case MESSAGE_TYPE_NOTIFICATION:
      return handleNotification(c, notification as EventSubNotificationPayload);

    case MESSAGE_TYPE_REVOCATION:
      return handleRevocation(c, notification as EventSubRevocationPayload);

    default:
      console.warn("Unknown message type", { messageType });
      return c.body(null, 204);
  }
}

/**
 * Handle webhook callback verification challenge
 *
 * When subscribing to an event, Twitch sends a challenge that must be
 * returned in the response body with status 200.
 */
function handleVerification(c: Context, notification: EventSubVerificationPayload) {
  const challenge = notification.challenge;

  if (!challenge || typeof challenge !== "string") {
    return c.json(
      {
        error: "Invalid challenge",
        message: "Challenge field is missing or invalid",
      },
      400
    );
  }

  console.log("EventSub verification challenge received", {
    subscriptionId: notification.subscription.id,
    subscriptionType: notification.subscription.type,
  });

  // Return the challenge as plain text with 200 status
  return c.text(challenge, 200);
}

/**
 * Handle event notifications
 *
 * Process actual events from Twitch (e.g., channel.follow, stream.online, etc.)
 * Must respond quickly (within a few seconds) or Twitch will revoke the subscription.
 */
async function handleNotification(c: Context, notification: EventSubNotificationPayload) {
  await handleEventsub(notification);
  return c.body(null, 204);
}

/**
 * Handle subscription revocation
 *
 * Twitch revokes subscriptions in various scenarios:
 * - User removed
 * - Authorization revoked
 * - Notification failures exceeded
 * - Version removed
 */
function handleRevocation(c: Context, notification: EventSubRevocationPayload) {
  const { subscription } = notification;

  console.warn("EventSub subscription revoked", {
    subscriptionId: subscription.id,
    subscriptionType: subscription.type,
    status: subscription.status,
    condition: subscription.condition,
  });

  // TODO: Handle revocation
  // Examples:
  // - Update database to mark subscription as revoked
  // - Clean up related data
  // - Notify administrators
  // - Attempt to resubscribe if appropriate

  return c.body(null, 204);
}
