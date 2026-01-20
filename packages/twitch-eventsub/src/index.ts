import type {
    EventSubSubscriptionType,
    WebSocketMessage,
    WebSocketNotificationMessage,
    WebSocketCloseCode,
} from '@repo/types';
import { TwitchApi } from "@repo/twitch-api";

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
 * Configuration options for the TwitchEventSubReceiver
 */
export interface EventSubReceiverOptions {
    /** The conduit ID for this receiver - required for updating shard transport */
    conduitId: string;
    /** Optional custom WebSocket URL (defaults to Twitch's production URL) */
    wsUrl?: string;
    /** Optional TwitchApi instance (will create one if not provided) */
    twitchApi?: TwitchApi;
    /** Maximum number of reconnection attempts (default: 10) */
    maxReconnectAttempts?: number;
    /** Base delay for reconnection in ms (default: 1000) */
    baseReconnectDelay?: number;
    /** Maximum delay for reconnection in ms (default: 30000) */
    maxReconnectDelay?: number;
    /** Maximum missed keepalives before disconnecting (default: 10) */
    maxMissedKeepalives?: number;
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
 * @example
 * ```typescript
 * import { TwitchEventSubReceiver, EventSubEventHandler } from '@repo/twitch-eventsub';
 * 
 * // Create your event handler
 * const myHandler: EventSubEventHandler = {
 *   async processEvent(eventType, message) {
 *     console.log('Received event:', eventType, message.payload.event);
 *   }
 * };
 * 
 * // Create and connect the receiver
 * const receiver = new TwitchEventSubReceiver(myHandler, {
 *   conduitId: 'your-conduit-id'
 * });
 * 
 * await receiver.connect();
 * ```
 */
export class TwitchEventSubReceiver {
    private ws: WebSocket | null = null;
    private sessionId: string | null = null;
    private reconnectUrl: string | null = null;
    private keepaliveTimer: NodeJS.Timeout | null = null;
    private keepaliveInterval: number = 10;
    private lastKeepaliveTime: number = Date.now();
    private missedKeepalives: number = 0;

    // Configuration
    private readonly wsUrl: string;
    private readonly conduitId: string;
    private readonly twitchApi: TwitchApi;
    private readonly maxReconnectAttempts: number;
    private readonly baseReconnectDelay: number;
    private readonly maxReconnectDelay: number;
    private readonly maxMissedKeepalives: number;

    // Connection state management
    private connectionState: ConnectionState = 'disconnected';
    private reconnectAttempts: number = 0;

    // Event handler
    private readonly eventHandler: HandlerRegistry;

    constructor(eventHandler: HandlerRegistry, options: EventSubReceiverOptions) {
        this.eventHandler = eventHandler;
        this.conduitId = options.conduitId;
        this.wsUrl = options.wsUrl ?? 'wss://eventsub.wss.twitch.tv/ws';
        this.twitchApi = options.twitchApi ?? new TwitchApi();
        this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
        this.baseReconnectDelay = options.baseReconnectDelay ?? 1000;
        this.maxReconnectDelay = options.maxReconnectDelay ?? 30000;
        this.maxMissedKeepalives = options.maxMissedKeepalives ?? 10;
    }

    /**
     * Get the current connection state
     */
    getConnectionState(): ConnectionState {
        return this.connectionState;
    }

    /**
     * Get the current session ID (available after connection)
     */
    getSessionId(): string | null {
        return this.sessionId;
    }

    /**
     * Connect to the Twitch EventSub WebSocket
     */
    async connect(): Promise<void> {
        if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
            console.log('⏳ Already connected or connecting');
            return;
        }

        try {
            this.connectionState = 'connecting';
            console.log('🔌 Connecting to Twitch EventSub WebSocket...');

            this.cleanup();
            this.ws = new WebSocket(this.wsUrl);
            this.setupEventHandlers();
        } catch (error) {
            console.error('❌ Connection failed:', error);
            this.connectionState = 'disconnected';
            throw error;
        }
    }

    /**
     * Gracefully disconnect from the WebSocket
     */
    async disconnect(): Promise<void> {
        console.log('🛑 Disconnecting from Twitch EventSub...');
        this.connectionState = 'disconnected';
        this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
        this.cleanup();
    }

    // ==========================================================================
    // Private Methods
    // ==========================================================================

    private getReconnectDelay(): number {
        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
            this.maxReconnectDelay
        );
        // Add jitter to prevent thundering herd
        return delay + Math.random() * 1000;
    }

    private async reconnect(): Promise<void> {
        if (this.connectionState === 'connecting' || this.connectionState === 'reconnecting') {
            console.log('⏳ Already attempting to connect, skipping duplicate reconnect');
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached. Giving up.');
            this.connectionState = 'disconnected';
            return;
        }

        this.connectionState = 'reconnecting';
        this.reconnectAttempts++;

        if (this.reconnectUrl) {
            try {
                console.log(
                    `🔄 Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) using reconnect URL...`
                );
                this.cleanup();
                this.ws = new WebSocket(this.reconnectUrl);
                this.setupEventHandlers();
                this.connectionState = 'connected';
                this.reconnectAttempts = 0;
            } catch (error) {
                console.error('❌ Reconnection failed:', error);
                this.scheduleReconnect();
            }
        } else {
            await this.connect();
        }
    }

    private scheduleReconnect(): void {
        const delay = this.getReconnectDelay();
        console.log(`⏰ Scheduling reconnect in ${delay}ms...`);
        setTimeout(() => this.reconnect(), delay);
    }

    private cleanup(): void {
        if (this.keepaliveTimer) {
            clearTimeout(this.keepaliveTimer);
            this.keepaliveTimer = null;
        }

        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onerror = null;
            this.ws.onclose = null;

            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
            this.ws = null;
        }
    }

    private setupEventHandlers(): void {
        if (!this.ws) return;

        this.ws.onopen = () => {
            console.log('✅ WebSocket connected');
            this.connectionState = 'connected';
            this.reconnectAttempts = 0;
        };

        this.ws.onmessage = async (event) => {
            try {
                const message: WebSocketMessage = JSON.parse(event.data as string);
                await this.handleMessage(message);
            } catch (error) {
                console.error('❌ Error parsing WebSocket message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };

        this.ws.onclose = (event) => this.handleClose(event);
    }

    private startKeepaliveTimer(timeoutSeconds: number): void {
        if (this.keepaliveTimer) {
            clearTimeout(this.keepaliveTimer);
        }

        this.keepaliveInterval = timeoutSeconds;
        const checkInterval = (timeoutSeconds + 2) * 1000;

        this.keepaliveTimer = setTimeout(() => {
            this.checkKeepalive();
        }, checkInterval);
    }

    private async checkKeepalive(): Promise<void> {
        const now = Date.now();
        const timeSinceLastKeepalive = now - this.lastKeepaliveTime;
        const expectedInterval = this.keepaliveInterval * 1000;

        if (timeSinceLastKeepalive > expectedInterval + 2000) {
            this.missedKeepalives++;

            if (this.missedKeepalives >= this.maxMissedKeepalives) {
                this.ws?.close();
                return;
            }
        }

        const nextCheckIn = this.keepaliveInterval * 1000;
        this.keepaliveTimer = setTimeout(() => {
            this.checkKeepalive();
        }, nextCheckIn);
    }

    private async handleMessage(message: WebSocketMessage): Promise<void> {
        const { metadata, payload } = message;

        switch (metadata.message_type) {
            case 'session_welcome':
                this.sessionId = (payload as { session?: { id?: string } }).session?.id || null;
                this.reconnectUrl = (payload as { session?: { reconnect_url?: string } }).session?.reconnect_url || null;
                this.lastKeepaliveTime = Date.now();

                const welcomeSession = (payload as { session?: { keepalive_timeout_seconds?: number } }).session;
                if (welcomeSession?.keepalive_timeout_seconds) {
                    this.startKeepaliveTimer(welcomeSession.keepalive_timeout_seconds);
                }

                // Update conduit shards with the new session ID
                if (this.conduitId && this.sessionId) {
                    try {
                        console.log('Updating conduit shards with session ID:', this.sessionId);
                        await this.twitchApi.eventsub.updateShardTransport(this.conduitId, '0', {
                            method: 'websocket',
                            session_id: this.sessionId,
                        });
                    } catch (error) {
                        console.error('❌ Failed to update conduit shards:', error);
                    }
                }
                break;

            case 'session_keepalive':
                this.lastKeepaliveTime = Date.now();
                this.missedKeepalives = 0;

                const keepaliveSession = (payload as { session?: { keepalive_timeout_seconds?: number } }).session;
                if (keepaliveSession?.keepalive_timeout_seconds) {
                    this.keepaliveInterval = keepaliveSession.keepalive_timeout_seconds;
                }
                break;

            case 'notification':
                const notificationMessage = {
                    metadata,
                    payload,
                } as WebSocketNotificationMessage;

                if (metadata.subscription_type && (payload as { event?: unknown }).event) {
                    await this.eventHandler.processTwitchEvent(
                        metadata.subscription_type as EventSubSubscriptionType,
                        notificationMessage
                    );
                }
                break;

            case 'session_reconnect':
                console.log('🔄 Session reconnect requested');
                this.reconnectUrl = (payload as { session?: { reconnect_url?: string } }).session?.reconnect_url || null;
                if (this.reconnectUrl) {
                    setTimeout(() => {
                        this.ws?.close();
                    }, 5000);
                } else {
                    console.error('❌ Reconnect URL not provided in session_reconnect message');
                }
                break;

            case 'revocation':
                const subscription = (payload as { subscription?: { status?: string; type?: string } }).subscription;
                const revocationReason = this.getRevocationReason(subscription?.status);
                console.warn(`⚠️ Subscription revoked (${subscription?.type}): ${revocationReason}`);
                break;

            default:
                // Unknown message type
                break;
        }
    }

    private getRevocationReason(status: string | undefined): string {
        switch (status) {
            case 'user_removed':
                return 'The user no longer exists';
            case 'authorization_revoked':
                return 'The authorization token was revoked';
            case 'version_removed':
                return 'The subscription type/version is no longer supported';
            default:
                return 'Unknown reason';
        }
    }

    private getCloseReason(code: number): string {
        switch (code) {
            case 4000:
                return 'Internal server error';
            case 4001:
                return 'Client sent inbound traffic';
            case 4002:
                return 'Client failed ping-pong';
            case 4003:
                return 'Connection unused';
            case 4004:
                return 'Reconnect grace time expired';
            case 4005:
                return 'Network timeout';
            case 4006:
                return 'Network error';
            case 4007:
                return 'Invalid reconnect URL';
            case 1000:
                return 'Normal closure';
            default:
                return 'Unknown close code';
        }
    }

    private async handleClose(event: CloseEvent): Promise<void> {
        const closeCode = event.code;
        const closeReason = this.getCloseReason(closeCode);
        console.log(`🔌 WebSocket closed: ${closeCode} - ${closeReason}`);

        this.connectionState = 'disconnected';
        this.cleanup();

        switch (closeCode) {
            case 4001: // Client sent inbound traffic - don't reconnect
                console.error("❌ Client error - not reconnecting");
                return;

            case 4003: // Connection unused
                console.warn("⚠️ Connection unused - reconnecting with fresh connection");
                this.reconnectUrl = null;
                this.scheduleReconnect();
                break;

            case 4007: // Invalid reconnect URL
                console.warn("⚠️ Invalid reconnect URL - will use fresh connection");
                this.reconnectUrl = null;
                this.scheduleReconnect();
                break;

            case 1000: // Normal closure
                console.log("✅ Normal closure");
                if (this.reconnectUrl) {
                    this.scheduleReconnect();
                }
                break;

            default:
                if (this.reconnectUrl) {
                    console.log("🔄 Using reconnect URL for recovery");
                    this.scheduleReconnect();
                } else {
                    console.log("🔄 No reconnect URL, will create fresh connection");
                    this.scheduleReconnect();
                }
        }
    }
}

// Re-export types from @repo/types for convenience
export type {
    EventSubSubscriptionType,
    WebSocketMessage,
    WebSocketNotificationMessage,
    WebSocketCloseCode,
    EventSubNotificationPayload,
    EventSubSubscriptionMetadata,
} from '@repo/types';
