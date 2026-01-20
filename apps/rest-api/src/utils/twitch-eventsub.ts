import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@repo/env";

/**
 * Twitch EventSub Webhook Constants
 */
export const TWITCH_MESSAGE_ID = "twitch-eventsub-message-id";
export const TWITCH_MESSAGE_TIMESTAMP = "twitch-eventsub-message-timestamp";
export const TWITCH_MESSAGE_SIGNATURE = "twitch-eventsub-message-signature";
export const TWITCH_MESSAGE_TYPE = "twitch-eventsub-message-type";
export const TWITCH_SUBSCRIPTION_TYPE = "twitch-eventsub-subscription-type";
export const TWITCH_SUBSCRIPTION_VERSION = "twitch-eventsub-subscription-version";

/**
 * EventSub Message Types
 */
export const MESSAGE_TYPE_VERIFICATION = "webhook_callback_verification";
export const MESSAGE_TYPE_NOTIFICATION = "notification";
export const MESSAGE_TYPE_REVOCATION = "revocation";

/**
 * HMAC prefix used by Twitch
 */
const HMAC_PREFIX = "sha256=";

/**
 * Get the webhook secret from environment
 */
export function getWebhookSecret(): string {
    return env.TWITCH_WEBHOOK_SECRET;
}

/**
 * Build the message used to generate the HMAC signature
 * Order is important: messageId + timestamp + body
 */
export function buildHmacMessage(
    messageId: string,
    timestamp: string,
    body: string | ArrayBuffer
): string {
    const bodyString =
        typeof body === "string" ? body : new TextDecoder().decode(body);
    return messageId + timestamp + bodyString;
}

/**
 * Generate HMAC-SHA256 signature
 */
export function generateHmac(secret: string, message: string): string {
    return createHmac("sha256", secret).update(message).digest("hex");
}

/**
 * Verify the HMAC signature from Twitch
 * Uses timing-safe comparison to prevent timing attacks
 */
export function verifySignature(
    messageId: string,
    timestamp: string,
    body: string | ArrayBuffer,
    receivedSignature: string
): boolean {
    const secret = getWebhookSecret();
    const message = buildHmacMessage(messageId, timestamp, body);
    const expectedHmac = generateHmac(secret, message);
    const expectedSignature = HMAC_PREFIX + expectedHmac;

    // Timing-safe comparison using Node's crypto.timingSafeEqual
    try {
        return timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(receivedSignature)
        );
    } catch {
        // If buffers are different lengths, timingSafeEqual throws
        return false;
    }
}

/**
 * Extract headers from request (case-insensitive)
 */
export function getTwitchHeader(
    headers: Headers,
    headerName: string
): string | null {
    // Headers are case-insensitive, but we need to check both cases
    const lowerName = headerName.toLowerCase();
    for (const [key, value] of headers.entries()) {
        if (key.toLowerCase() === lowerName) {
            return value;
        }
    }
    return null;
}

