/**
 * Twitch EventSub Types
 * Reference: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
 */

// ==============================================================================
// 1. Message Types
// ==============================================================================

/**
 * WebSocket-specific message types
 */
export type WebSocketMessageType =
    | 'session_welcome'       // Sent when WebSocket connection opens
    | 'session_keepalive'     // Periodic heartbeat
    | 'session_reconnect'     // Server requesting reconnect
    | 'notification'          // The actual event data
    | 'revocation';           // Subscription was revoked

/**
 * Webhook-specific message types (from Twitch-Eventsub-Message-Type header)
 */
export type WebhookMessageType =
    | 'notification'                    // The actual event data
    | 'webhook_callback_verification'   // Verifying endpoint ownership
    | 'revocation';                     // Subscription was revoked

/**
 * All EventSub message types (union of both transports)
 */
export type EventSubMessageType = WebSocketMessageType | WebhookMessageType;

// ==============================================================================
// 2. Subscription Types (The 'type' string)
// ==============================================================================

/**
 * All available EventSub subscription types.
 * Use these strings when creating a subscription.
 */
export type EventSubSubscriptionType =
    // Automod Topics
    | "automod.message.hold"
    | "automod.message.update"
    | "automod.settings.update"
    | "automod.terms.update"

    // Channel Topics
    | "channel.update"
    | "channel.follow"
    | "channel.ad_break.begin"
    | "channel.chat.clear"
    | "channel.chat.clear_user_messages"
    | "channel.chat.message"
    | "channel.chat.message_delete"
    | "channel.chat.notification"
    | "channel.chat_settings.update"
    | "channel.chat.user_message_hold"
    | "channel.chat.user_message_update"
    | "channel.shared_chat.begin"
    | "channel.shared_chat.update"
    | "channel.shared_chat.end"
    | "channel.subscribe"
    | "channel.subscription.end"
    | "channel.subscription.gift"
    | "channel.subscription.message"
    | "channel.cheer"
    | "channel.raid"
    | "channel.ban"
    | "channel.unban"
    | "channel.unban_request.create"
    | "channel.unban_request.resolve"
    | "channel.moderate"
    | "channel.moderator.add"
    | "channel.moderator.remove"

    // Guest Star Topics (BETA)
    | "channel.guest_star_session.begin"
    | "channel.guest_star_session.end"
    | "channel.guest_star_guest.update"
    | "channel.guest_star_settings.update"

    // Channel Points Topics
    | "channel.channel_points_automatic_reward_redemption.add"
    | "channel.channel_points_custom_reward.add"
    | "channel.channel_points_custom_reward.update"
    | "channel.channel_points_custom_reward.remove"
    | "channel.channel_points_custom_reward_redemption.add"
    | "channel.channel_points_custom_reward_redemption.update"

    // Poll/Prediction Topics
    | "channel.poll.begin"
    | "channel.poll.progress"
    | "channel.poll.end"
    | "channel.prediction.begin"
    | "channel.prediction.progress"
    | "channel.prediction.lock"
    | "channel.prediction.end"

    // Moderation & Safety Topics
    | "channel.suspicious_user.message"
    | "channel.suspicious_user.update"
    | "channel.vip.add"
    | "channel.vip.remove"
    | "channel.warning.acknowledge"
    | "channel.warning.send"

    // Charity Topics
    | "channel.charity_campaign.donate"
    | "channel.charity_campaign.start"
    | "channel.charity_campaign.progress"
    | "channel.charity_campaign.stop"

    // Infrastructure Topics
    | "conduit.shard.disabled"

    // Drops & Extensions
    | "drop.entitlement.grant"
    | "extension.bits_transaction.create"

    // Authorization & User Topics
    | "user.authorization.grant"
    | "user.authorization.revoke"
    | "user.update"
    | "user.whisper.message"

    // Stream Status Topics
    | "stream.online"
    | "stream.offline"

    // Hype Train Topics
    | "channel.hype_train.begin"
    | "channel.hype_train.progress"
    | "channel.hype_train.end"

    // Shield Mode Topics
    | "channel.shield_mode.begin"
    | "channel.shield_mode.end"

    // Shoutout Topics
    | "channel.shoutout.create"
    | "channel.shoutout.receive";

// ==============================================================================
// 3. Common Data Structures
// ==============================================================================

/**
 * The 'condition' object used to filter events (e.g., specific broadcaster).
 * This varies slightly by subscription type, but these are the common keys.
 */
export interface EventSubCondition {
    broadcaster_user_id?: string;
    moderator_user_id?: string;
    user_id?: string;
    from_broadcaster_user_id?: string;
    to_broadcaster_user_id?: string;
    reward_id?: string;
    client_id?: string;
    extension_client_id?: string;
    organization_id?: string;
    category_id?: string;
    campaign_id?: string;
}

/**
 * Transport for Webhook
 */
export interface WebhookTransport {
    method: 'webhook';
    callback: string;
    secret?: string;  // Only included when creating subscription
}

/**
 * Transport for WebSocket
 */
export interface WebSocketTransport {
    method: 'websocket';
    session_id: string;
    connected_at?: string;  // Included in responses
    disconnected_at?: string;  // Included if session disconnected
}

/**
 * Transport for Conduit
 */
export interface ConduitTransport {
    method: 'conduit';
    conduit_id: string;
}

/**
 * Union of all transport types
 */
export type EventSubTransport = WebhookTransport | WebSocketTransport | ConduitTransport;

/**
 * Subscription status values
 */
export type EventSubSubscriptionStatus =
    | 'enabled'
    | 'webhook_callback_verification_pending'  // Webhook only
    | 'notification_failures_exceeded'         // Webhook only
    | 'authorization_revoked'
    | 'user_removed'
    | 'version_removed';

/**
 * Metadata about the subscription attached to every notification.
 */
export interface EventSubSubscriptionMetadata {
    id: string;
    type: EventSubSubscriptionType;
    version: string;
    status: EventSubSubscriptionStatus;
    cost: number;
    condition: EventSubCondition;
    transport: EventSubTransport;
    created_at: string;
}

// ==============================================================================
// 4. Webhook-Specific Types
// ==============================================================================

/**
 * Headers sent by Twitch with webhook requests
 */
export interface WebhookRequestHeaders {
    'twitch-eventsub-message-id': string;
    'twitch-eventsub-message-retry': string;
    'twitch-eventsub-message-type': WebhookMessageType;
    'twitch-eventsub-message-signature': string;
    'twitch-eventsub-message-timestamp': string;
    'twitch-eventsub-subscription-type': EventSubSubscriptionType;
    'twitch-eventsub-subscription-version': string;
}

/**
 * Payload for webhook verification challenges
 */
export interface WebhookVerificationPayload {
    subscription: EventSubSubscriptionMetadata;
    challenge: string;
}

/**
 * Payload for webhook notifications
 */
export interface WebhookNotificationPayload<T = any> {
    subscription: EventSubSubscriptionMetadata;
    event: T;
}

/**
 * Payload for webhook revocations
 */
export interface WebhookRevocationPayload {
    subscription: EventSubSubscriptionMetadata;
}

// ==============================================================================
// 5. WebSocket-Specific Types
// ==============================================================================

/**
 * WebSocket session info
 */
export interface WebSocketSession {
    id: string;
    status: 'connected' | 'reconnecting';
    connected_at: string;
    keepalive_timeout_seconds: number;
    reconnect_url: string | null;
}

/**
 * Metadata for WebSocket messages
 */
export interface WebSocketMessageMetadata {
    message_id: string;
    message_type: WebSocketMessageType;
    message_timestamp: string;
    subscription_type?: EventSubSubscriptionType;  // Only for notification/revocation
    subscription_version?: string;  // Only for notification/revocation
}

/**
 * WebSocket welcome message
 */
export interface WebSocketWelcomeMessage {
    metadata: WebSocketMessageMetadata;
    payload: {
        session: WebSocketSession;
    };
}

/**
 * WebSocket keepalive message
 */
export interface WebSocketKeepaliveMessage {
    metadata: WebSocketMessageMetadata;
    payload: Record<string, never>;  // Empty object
}

/**
 * WebSocket reconnect message
 */
export interface WebSocketReconnectMessage {
    metadata: WebSocketMessageMetadata;
    payload: {
        session: WebSocketSession;
    };
}

/**
 * WebSocket notification message
 */
export interface WebSocketNotificationMessage<T = any> {
    metadata: WebSocketMessageMetadata;
    payload: {
        subscription: EventSubSubscriptionMetadata;
        event: T;
    };
}

/**
 * WebSocket revocation message
 */
export interface WebSocketRevocationMessage {
    metadata: WebSocketMessageMetadata;
    payload: {
        subscription: EventSubSubscriptionMetadata;
    };
}

/**
 * Union of all WebSocket message types
 */
export type WebSocketMessage<T = any> =
    | WebSocketWelcomeMessage
    | WebSocketKeepaliveMessage
    | WebSocketReconnectMessage
    | WebSocketNotificationMessage<T>
    | WebSocketRevocationMessage;

/**
 * WebSocket close codes
 */
export enum WebSocketCloseCode {
    InternalServerError = 4000,
    ClientSentInboundTraffic = 4001,
    ClientFailedPingPong = 4002,
    ConnectionUnused = 4003,
    ReconnectGraceTimeExpired = 4004,
    NetworkTimeout = 4005,
    NetworkError = 4006,
    InvalidReconnect = 4007,
}

// ==============================================================================
// 6. Generic Payloads (For compatibility)
// ==============================================================================

/**
 * Generic notification payload (works for both transports)
 */
export interface EventSubNotificationPayload<T = any> {
    subscription: EventSubSubscriptionMetadata;
    event: T;
}

/**
 * Generic verification payload (webhook only)
 */
export interface EventSubVerificationPayload {
    subscription: EventSubSubscriptionMetadata;
    challenge: string;
}

/**
 * Generic revocation payload (both transports)
 */
export interface EventSubRevocationPayload {
    subscription: EventSubSubscriptionMetadata;
}