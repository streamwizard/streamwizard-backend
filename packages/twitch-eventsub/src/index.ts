import type {
    EventSubSubscriptionType,
    WebSocketMessage,
    WebSocketNotificationMessage,
    WebSocketCloseCode,
} from '@repo/types';
import { TwitchApi } from "@repo/twitch-api";
import { closeReason, revocationReason } from "./reasons";

export type {
    ConnectionState,
    EventSubLifecycleEvent,
    EventSubReceiverOptions,
    HandlerRegistry,
} from "./types";
import type {
    ConnectionState,
    EventSubLifecycleEvent,
    EventSubReceiverOptions,
    HandlerRegistry,
} from "./types";

export class TwitchEventSubReceiver {
    private ws: WebSocket | null = null;
    private sessionId: string | null = null;
    private keepaliveTimer: NodeJS.Timeout | null = null;
    private keepaliveIntervalSeconds: number = 10;
    private lastMessageTime: number = Date.now();

    // Socket generations: handlers capture their generation at attach time and
    // no-op when it no longer matches, so an abandoned socket can never fire
    // stale callbacks into current state.
    private generationCounter: number = 0;
    private activeGen: number = -1;

    // Migration socket during session_reconnect (old socket stays live until
    // the new one receives its welcome).
    private pendingWs: WebSocket | null = null;
    private pendingGen: number = -1;
    private pendingWelcomeTimer: NodeJS.Timeout | null = null;

    private welcomeTimer: NodeJS.Timeout | null = null;
    private reconnectTimer: NodeJS.Timeout | null = null;

    // Configuration
    private readonly wsUrl: string;
    private readonly conduitId: string;
    private readonly twitchApi: TwitchApi;
    private readonly baseReconnectDelay: number;
    private readonly maxReconnectDelay: number;
    private readonly keepaliveGraceMs: number;
    private readonly welcomeTimeoutMs: number;
    private readonly onLifecycleEvent?: (event: EventSubLifecycleEvent) => void;

    // Connection state management
    private connectionState: ConnectionState = 'disconnected';
    private reconnectAttempts: number = 0;
    private disconnectedSince: number | null = null;
    private disposed: boolean = false;

    // Event handler
    private readonly eventHandler: HandlerRegistry;

    constructor(eventHandler: HandlerRegistry, options: EventSubReceiverOptions) {
        this.eventHandler = eventHandler;
        this.conduitId = options.conduitId;
        this.wsUrl = options.wsUrl ?? 'wss://eventsub.wss.twitch.tv/ws';
        this.twitchApi = options.twitchApi ?? new TwitchApi();
        this.baseReconnectDelay = options.baseReconnectDelay ?? 1000;
        this.maxReconnectDelay = options.maxReconnectDelay ?? 30000;
        this.keepaliveGraceMs = options.keepaliveGraceMs ?? 5000;
        this.welcomeTimeoutMs = options.welcomeTimeoutMs ?? 15000;
        this.onLifecycleEvent = options.onLifecycleEvent;
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

        this.disposed = false;
        this.connectionState = 'connecting';
        console.log('🔌 Connecting to Twitch EventSub WebSocket...');
        this.openSocket(this.wsUrl);
    }

    /**
     * Gracefully disconnect from the WebSocket. This is the only way the
     * receiver stops for good; call connect() again to resume.
     */
    async disconnect(): Promise<void> {
        console.log('🛑 Disconnecting from Twitch EventSub...');
        this.disposed = true;
        this.connectionState = 'disconnected';
        this.clearAllTimers();
        this.abandonPendingSocket();
        this.abandonActiveSocket();
    }

    // ==========================================================================
    // Private Methods
    // ==========================================================================

    private emit(event: EventSubLifecycleEvent): void {
        try {
            this.onLifecycleEvent?.(event);
        } catch (error) {
            console.error('❌ Lifecycle event handler threw:', error);
        }
    }

    // --------------------------------------------------------------------------
    // Socket management
    // --------------------------------------------------------------------------

    private openSocket(url: string): void {
        if (this.disposed) return;

        this.abandonActiveSocket();

        const gen = ++this.generationCounter;
        this.activeGen = gen;

        let ws: WebSocket;
        try {
            ws = new WebSocket(url);
        } catch (error) {
            console.error('❌ Failed to create WebSocket:', error);
            this.handleConnectionLoss(null, `socket creation failed: ${String(error)}`);
            return;
        }

        this.ws = ws;
        this.attachHandlers(ws, gen);
        this.armWelcomeTimer(gen);
    }

    private attachHandlers(ws: WebSocket, gen: number): void {
        ws.onopen = () => {
            if (gen !== this.activeGen || this.disposed) return;
            console.log('✅ WebSocket connected, waiting for session welcome...');
        };

        ws.onmessage = async (event) => {
            if (gen !== this.activeGen || this.disposed) return;
            // Any inbound frame proves the connection is alive — notifications
            // reset Twitch's keepalive cadence, not just keepalive messages.
            this.lastMessageTime = Date.now();
            this.armKeepaliveDeadline();
            try {
                const message: WebSocketMessage = JSON.parse(event.data as string);
                await this.handleMessage(message, gen);
            } catch (error) {
                console.error('❌ Error parsing WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            if (gen !== this.activeGen || this.disposed) return;
            console.error('❌ WebSocket error:', error);
        };

        ws.onclose = (event) => {
            if (gen !== this.activeGen || this.disposed) return;
            this.handleClose(event);
        };
    }

    private abandonActiveSocket(): void {
        this.activeGen = -1;
        if (this.ws) {
            this.detachAndClose(this.ws);
            this.ws = null;
        }
    }

    private abandonPendingSocket(): void {
        this.pendingGen = -1;
        if (this.pendingWelcomeTimer) {
            clearTimeout(this.pendingWelcomeTimer);
            this.pendingWelcomeTimer = null;
        }
        if (this.pendingWs) {
            this.detachAndClose(this.pendingWs);
            this.pendingWs = null;
        }
    }

    private detachAndClose(ws: WebSocket): void {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
        } catch {
            // best-effort close; the socket may already be dead
        }
    }

    private clearAllTimers(): void {
        for (const timer of [this.keepaliveTimer, this.welcomeTimer, this.reconnectTimer, this.pendingWelcomeTimer]) {
            if (timer) clearTimeout(timer);
        }
        this.keepaliveTimer = null;
        this.welcomeTimer = null;
        this.reconnectTimer = null;
        this.pendingWelcomeTimer = null;
    }

    // --------------------------------------------------------------------------
    // Liveness watchdogs
    // --------------------------------------------------------------------------

    private armWelcomeTimer(gen: number): void {
        if (this.welcomeTimer) clearTimeout(this.welcomeTimer);
        this.welcomeTimer = setTimeout(() => {
            this.welcomeTimer = null;
            if (gen !== this.activeGen || this.disposed) return;
            console.warn(`⚠️ No session welcome within ${this.welcomeTimeoutMs}ms`);
            this.handleConnectionLoss(null, 'welcome timeout');
        }, this.welcomeTimeoutMs);
    }

    private armKeepaliveDeadline(): void {
        if (this.keepaliveTimer) clearTimeout(this.keepaliveTimer);
        const deadlineMs = this.keepaliveIntervalSeconds * 1000 + this.keepaliveGraceMs;
        this.keepaliveTimer = setTimeout(() => {
            this.keepaliveTimer = null;
            if (this.disposed) return;
            // A migration is already replacing this socket; let its own
            // welcome timer decide the outcome.
            if (this.pendingWs) {
                this.armKeepaliveDeadline();
                return;
            }
            const silentForMs = Date.now() - this.lastMessageTime;
            console.warn(`⚠️ Keepalive timeout — no messages for ${silentForMs}ms`);
            this.emit({ type: 'keepalive_timeout', silentForMs });
            // Don't wait for onclose: a NAT-dropped TCP connection may never
            // deliver one. Abandon the socket and reconnect immediately.
            this.handleConnectionLoss(null, 'keepalive timeout');
        }, deadlineMs);
    }

    // --------------------------------------------------------------------------
    // Reconnection
    // --------------------------------------------------------------------------

    private getReconnectDelay(): number {
        // Clamp the exponent so long outages don't overflow the doubling
        const exponent = Math.min(this.reconnectAttempts, 6);
        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, exponent),
            this.maxReconnectDelay
        );
        // Add jitter to prevent thundering herd
        return delay + Math.random() * 1000;
    }

    private handleConnectionLoss(code: number | null, reason: string): void {
        if (this.disposed) return;

        this.abandonActiveSocket();
        this.abandonPendingSocket();
        if (this.keepaliveTimer) {
            clearTimeout(this.keepaliveTimer);
            this.keepaliveTimer = null;
        }
        if (this.welcomeTimer) {
            clearTimeout(this.welcomeTimer);
            this.welcomeTimer = null;
        }

        // Emit connection_lost once per outage, not once per failed retry
        if (this.disconnectedSince === null) {
            this.disconnectedSince = Date.now();
            this.emit({ type: 'connection_lost', code, reason });
        }

        this.scheduleReconnect();
    }

    private scheduleReconnect(): void {
        if (this.disposed) return;
        if (this.reconnectTimer) return; // already scheduled

        this.connectionState = 'reconnecting';
        const delay = this.getReconnectDelay();
        const attempt = this.reconnectAttempts + 1;
        console.log(`⏰ Scheduling reconnect attempt ${attempt} in ${Math.round(delay)}ms...`);
        this.emit({ type: 'reconnect_scheduled', attempt, delayMs: Math.round(delay) });

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.disposed) return;
            this.reconnectAttempts++;
            this.connectionState = 'connecting';
            console.log(`🔄 Reconnecting (attempt ${this.reconnectAttempts})...`);
            // Always reconnect to the fresh URL; Twitch reconnect URLs expire
            // ~30s after session_reconnect and are only used for migration.
            this.openSocket(this.wsUrl);
        }, delay);
    }

    // --------------------------------------------------------------------------
    // Message handling
    // --------------------------------------------------------------------------

    private async handleMessage(message: WebSocketMessage, gen: number): Promise<void> {
        const { metadata, payload } = message;

        switch (metadata.message_type) {
            case 'session_welcome':
                await this.handleWelcome(payload, gen, false);
                break;

            case 'session_keepalive':
                // lastMessageTime/keepalive deadline already handled in onmessage
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
                this.handleSessionReconnect(payload);
                break;

            case 'revocation':
                const subscription = (payload as { subscription?: { status?: string; type?: string } }).subscription;
                const revokedBecause = revocationReason(subscription?.status);
                console.warn(`⚠️ Subscription revoked (${subscription?.type}): ${revokedBecause}`);
                this.emit({
                    type: 'subscription_revoked',
                    subscriptionType: subscription?.type ?? 'unknown',
                    status: subscription?.status ?? 'unknown',
                    reason: revokedBecause,
                });
                break;

            default:
                // Unknown message type
                break;
        }
    }

    private async handleWelcome(payload: unknown, gen: number, isMigration: boolean): Promise<void> {
        const session = (payload as {
            session?: { id?: string; keepalive_timeout_seconds?: number };
        }).session;

        this.sessionId = session?.id || null;
        this.lastMessageTime = Date.now();

        if (this.welcomeTimer) {
            clearTimeout(this.welcomeTimer);
            this.welcomeTimer = null;
        }

        if (session?.keepalive_timeout_seconds) {
            this.keepaliveIntervalSeconds = session.keepalive_timeout_seconds;
        }
        this.armKeepaliveDeadline();

        this.connectionState = 'connected';
        const attempt = this.reconnectAttempts;
        const downtimeMs = this.disconnectedSince !== null ? Date.now() - this.disconnectedSince : null;
        this.reconnectAttempts = 0;
        this.disconnectedSince = null;

        console.log(`✅ Session established: ${this.sessionId}${downtimeMs !== null ? ` (recovered after ${downtimeMs}ms)` : ''}`);
        this.emit({ type: 'connected', sessionId: this.sessionId ?? '', attempt, downtimeMs });

        // On a Twitch-requested migration the subscriptions carry over to the
        // new session, so the conduit shard doesn't need to be rebound.
        if (!isMigration && this.conduitId && this.sessionId) {
            await this.updateConduitShard(this.sessionId, gen);
        }
    }

    private async updateConduitShard(sessionId: string, gen: number): Promise<void> {
        // A socket whose shard isn't bound receives nothing, so retry a few
        // times before alerting.
        const retryDelays = [1000, 2000, 4000];
        for (let attempt = 0; ; attempt++) {
            if (gen !== this.activeGen || this.disposed) return;
            try {
                console.log('Updating conduit shards with session ID:', sessionId);
                await this.twitchApi.eventsub.updateShardTransport(this.conduitId, '0', {
                    method: 'websocket',
                    session_id: sessionId,
                });
                return;
            } catch (error) {
                if (attempt >= retryDelays.length) {
                    console.error('❌ Failed to update conduit shards after retries:', error);
                    this.emit({ type: 'conduit_update_failed', error });
                    return;
                }
                console.warn(`⚠️ Conduit shard update failed, retrying in ${retryDelays[attempt]}ms...`, error);
                await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
            }
        }
    }

    // --------------------------------------------------------------------------
    // Twitch-requested session migration
    // --------------------------------------------------------------------------

    private handleSessionReconnect(payload: unknown): void {
        console.log('🔄 Session reconnect requested by Twitch');
        this.emit({ type: 'session_reconnect_requested' });

        const reconnectUrl = (payload as { session?: { reconnect_url?: string } }).session?.reconnect_url;
        if (!reconnectUrl) {
            console.error('❌ Reconnect URL not provided in session_reconnect message');
            // Close the socket; the normal recovery path reconnects fresh
            this.handleConnectionLoss(null, 'session_reconnect without reconnect URL');
            return;
        }

        // Per Twitch docs: open the new connection while the old one keeps
        // delivering events, and only drop the old one after the new welcome.
        this.abandonPendingSocket();

        const gen = ++this.generationCounter;
        this.pendingGen = gen;

        let pendingWs: WebSocket;
        try {
            pendingWs = new WebSocket(reconnectUrl);
        } catch (error) {
            console.error('❌ Failed to open migration socket:', error);
            this.pendingGen = -1;
            this.handleConnectionLoss(null, 'migration socket creation failed');
            return;
        }

        this.pendingWs = pendingWs;

        pendingWs.onmessage = async (event) => {
            if (gen !== this.pendingGen || this.disposed) return;
            try {
                const message: WebSocketMessage = JSON.parse(event.data as string);
                if (message.metadata.message_type === 'session_welcome') {
                    this.promotePendingSocket(pendingWs, gen, message.payload);
                }
                // Twitch sends nothing but the welcome on the new connection
                // until the old one is closed.
            } catch (error) {
                console.error('❌ Error parsing migration socket message:', error);
            }
        };

        pendingWs.onclose = () => {
            if (gen !== this.pendingGen || this.disposed) return;
            console.warn('⚠️ Migration socket closed before welcome — reconnecting fresh');
            this.handleConnectionLoss(null, 'migration socket closed before welcome');
        };

        pendingWs.onerror = (error) => {
            if (gen !== this.pendingGen || this.disposed) return;
            console.error('❌ Migration socket error:', error);
        };

        this.pendingWelcomeTimer = setTimeout(() => {
            this.pendingWelcomeTimer = null;
            if (gen !== this.pendingGen || this.disposed) return;
            console.warn('⚠️ Migration socket welcome timeout — reconnecting fresh');
            this.handleConnectionLoss(null, 'migration welcome timeout');
        }, this.welcomeTimeoutMs);
    }

    private promotePendingSocket(pendingWs: WebSocket, gen: number, welcomePayload: unknown): void {
        console.log('🔄 Migration socket received welcome, promoting...');

        if (this.pendingWelcomeTimer) {
            clearTimeout(this.pendingWelcomeTimer);
            this.pendingWelcomeTimer = null;
        }
        this.pendingWs = null;
        this.pendingGen = -1;

        // Drop the old socket silently — the new one is the live path now
        this.abandonActiveSocket();

        this.ws = pendingWs;
        this.activeGen = gen;
        this.attachHandlers(pendingWs, gen);

        // Migration welcomes keep the existing subscriptions; no shard rebind
        void this.handleWelcome(welcomePayload, gen, true);
    }

    // --------------------------------------------------------------------------
    // Close handling
    // --------------------------------------------------------------------------

    private handleClose(event: CloseEvent): void {
        const closeCode = event.code;
        const closedBecause = closeReason(closeCode);
        console.log(`🔌 WebSocket closed: ${closeCode} - ${closedBecause}`);

        // If a migration is in flight, the old socket closing is expected
        // (Twitch closes it with 4004 once the grace period ends).
        if (this.pendingWs) {
            console.log('ℹ️ Old socket closed during migration, new socket takes over');
            this.abandonActiveSocket();
            return;
        }

        // Every close code reconnects. 4001/4003/4007 indicate client bugs or
        // unused connections, but dying silently is never acceptable — log
        // loudly and try again with a fresh connection.
        if (closeCode === 4001 || closeCode === 4003 || closeCode === 4007) {
            console.warn(`⚠️ Close code ${closeCode} (${closedBecause}) — reconnecting with a fresh connection anyway`);
        }

        this.handleConnectionLoss(closeCode, closedBecause);
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
