import type {
    EventSubSubscriptionType,
    WebSocketNotificationMessage,
} from '@repo/types';
import type { TwitchApi } from "@repo/twitch-api";

// ==============================================================================
// Interfaces for Package Consumers
// ==============================================================================

/**
 * Interface that apps must implement to handle Twitch EventSub events.
 * This allows each app to define their own handler implementation.
 */
export interface HandlerRegistry {
    /**
     * Process a Twitch EventSub notification
     * @param eventType - The type of event (e.g., 'channel.follow', 'stream.online')
     * @param message - The full WebSocket notification message
     */
    processTwitchEvent(
        eventType: EventSubSubscriptionType,
        message: WebSocketNotificationMessage
    ): Promise<void>;
}

/**
 * Lifecycle events emitted by the receiver so consumers can wire up
 * alerting/metrics without the package taking on any dependencies.
 */
export type EventSubLifecycleEvent =
    | { type: 'connected'; sessionId: string; attempt: number; downtimeMs: number | null }
    | { type: 'connection_lost'; code: number | null; reason: string }
    | { type: 'reconnect_scheduled'; attempt: number; delayMs: number }
    | { type: 'keepalive_timeout'; silentForMs: number }
    | { type: 'session_reconnect_requested' }
    | { type: 'subscription_revoked'; subscriptionType: string; status: string; reason: string }
    | { type: 'conduit_update_failed'; error: unknown };

/**
 * Configuration options for the TwitchEventSubReceiver
 */
export interface EventSubReceiverOptions {
    /** The conduit ID for this receiver - required for updating shard transport */
    conduitId: string;
    /** Optional custom WebSocket URL (defaults to Twitch's production URL) */
    wsUrl?: string;
    /** Optional TwitchApi instance (will create one if not provided) */
    twitchApi?: TwitchApi;
    /** @deprecated ignored — the receiver retries forever */
    maxReconnectAttempts?: number;
    /** Base delay for reconnection in ms (default: 1000) */
    baseReconnectDelay?: number;
    /** Maximum delay for reconnection in ms (default: 30000) */
    maxReconnectDelay?: number;
    /** @deprecated ignored — replaced by a single keepalive deadline timer */
    maxMissedKeepalives?: number;
    /** Grace added to Twitch's keepalive_timeout_seconds before declaring the socket dead (default: 5000ms) */
    keepaliveGraceMs?: number;
    /** Max time to wait for session_welcome after opening a socket (default: 15000ms) */
    welcomeTimeoutMs?: number;
    /** Lifecycle event callback for alerting/metrics; errors thrown here are swallowed */
    onLifecycleEvent?: (event: EventSubLifecycleEvent) => void;
}

/**
 * Connection state of the EventSub receiver
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// ==============================================================================
// TwitchEventSubReceiver Class
// ==============================================================================

/**
 * A reusable Twitch EventSub WebSocket receiver that can be used across different apps.
 *
 * The receiver never terminally stops on its own: every close code, keepalive
 * timeout, or failed connection attempt schedules another reconnect with capped
 * exponential backoff. Only an explicit `disconnect()` call stops it.
 *
 * @example
 * ```typescript
 * import { TwitchEventSubReceiver } from '@repo/twitch-eventsub';
 *
 * const receiver = new TwitchEventSubReceiver(myHandler, {
 *   conduitId: 'your-conduit-id',
 *   onLifecycleEvent: (event) => console.log(event),
 * });
 *
 * await receiver.connect();
 * ```
 */
