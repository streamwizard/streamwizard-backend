import type { ServerWebSocket } from "bun";
import type { MinecraftRedemptionData } from "@/types/minecraft-outgoing-websocket-messages";
import customLogger from "@/lib/logger";
import { env } from "@repo/env";

interface ClientData {
  createdAt: number;
  connectionId: string;
}

// Handler type for WebSocket client messages
type ClientHandler = (data: unknown) => Promise<unknown>;

export class MinecraftWebSocketServer {
  private server!: ReturnType<typeof Bun.serve>;
  private currentClient: ServerWebSocket<ClientData> | null = null;
  private readonly MAX_MESSAGE_SIZE = 1024 * 1024;
  private connectionCounter = 0;
  private readonly AUTH_TOKEN: string;
  private clientHandlers = new Map<string, ClientHandler>();

  constructor() {
    this.AUTH_TOKEN = env.MINECRAFT_WS_AUTH_TOKEN;
  }

  /**
   * Register a handler for WebSocket client messages
   */
  registerClientHandler(eventType: string, handler: ClientHandler): void {
    this.clientHandlers.set(eventType, handler);
  }

  /**
   * Get a registered client handler
   */
  getClientHandler(eventType: string): ClientHandler | undefined {
    return this.clientHandlers.get(eventType);
  }


  start(): void {
    customLogger.info("🚀 Starting Minecraft WebSocket server on 0.0.0.0:8888");
    this.server = Bun.serve<ClientData>({
      hostname: "0.0.0.0",
      port: 8888,

      fetch: (req, server) => {
        // Check if we already have a connected client
        if (this.currentClient && this.currentClient.readyState === WebSocket.OPEN) {
          customLogger.warn("❌ Connection rejected: another client is already connected");
          return new Response("Another client is already connected", {
            status: 403,
            headers: { "Content-Security-Policy": "default-src 'none'" },
          });
        }

        // Extract token from Authorization header
        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

        if (!token || token !== this.AUTH_TOKEN) {
          customLogger.warn("❌ WebSocket upgrade failed: invalid or missing Authorization token", {
            hasHeader: !!authHeader,
            url: req.url,
          });
          return new Response("Unauthorized: Invalid or missing Authorization token", {
            status: 401,
            headers: {
              "Content-Security-Policy": "default-src 'none'",
              "WWW-Authenticate": "Bearer",
            },
          });
        }

        if (
          !server.upgrade(req, {
            data: {
              createdAt: Date.now(),
              connectionId: `conn-${++this.connectionCounter}`,
            },
          })
        ) {
          customLogger.warn("❌ WebSocket upgrade failed", { url: req.url });
          return new Response("WebSocket upgrade failed", {
            status: 400,
            headers: { "Content-Security-Policy": "default-src 'none'" },
          });
        }
        return undefined;
      },

      websocket: {
        maxPayloadLength: this.MAX_MESSAGE_SIZE,
        idleTimeout: 60,

        open: (ws) => {
          // Store as current client
          this.currentClient = ws;

          customLogger.info(`✅ Client connected`, {
            connectionId: ws.data.connectionId,
          });

          // Send welcome message
          ws.send(
            JSON.stringify({
              type: "connection_established",
              connectionId: ws.data.connectionId,
            })
          );
        },

        message: async (ws, message) => {
          const connectionId = ws.data.connectionId;

          try {
            const parsed = this.parseMessage(message.toString());
            customLogger.debug("📨 Received message", {
              connectionId,
              eventType: parsed.event_type,
            });
            await this.handleMessage(ws, parsed);
          } catch (error) {
            this.handleError(ws, error);
          }
        },

        close: (ws) => {
          // Clear current client if this was it
          if (this.currentClient === ws) {
            this.currentClient = null;
          }

          customLogger.info(`👋 Client disconnected`, {
            connectionId: ws.data.connectionId,
          });
        },

        drain: (ws) => { },

        ping: (ws, data) => {
          ws.pong(data.toString());
        },
      },
    });
  }

  private parseMessage(message: string | Uint8Array) {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);

    if (text.length > this.MAX_MESSAGE_SIZE) {
      throw new Error("Message size exceeds limit");
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async handleMessage(ws: ServerWebSocket<ClientData>, message: any): Promise<void> {
    const connectionId = ws.data.connectionId;
    let eventId: string | null = null;

    try {
      // Validate message structure
      if (!message || typeof message !== "object") {
        throw new Error("Invalid message format: expected object");
      }

      if (!message.event_type || typeof message.event_type !== "string") {
        throw new Error("Missing or invalid 'event_type' field");
      }

      const handler = this.getClientHandler(message.event_type);
      if (!handler) {
        customLogger.warn("⚠️ No handler for event type", {
          connectionId,
          eventType: message.event_type,
        });

        this.sendError(ws, `No handler for type: ${message.event_type}`);
        return;
      }

      const response = await handler(message);

      // Send response back to client if handler returns something
      if (response !== undefined) {
        this.sendResponse(ws, response);
      }
    } catch (error) {
      this.handleError(ws, error);
    }
  }

  private sendResponse(ws: ServerWebSocket<ClientData>, data: unknown): void {
    try {
      const payload = JSON.stringify({ success: true, data });
      ws.send(payload);
    } catch (error) {
      customLogger.error("❌ Failed to send response", {
        connectionId: ws.data.connectionId,
        error,
      });
    }
  }

  private sendError(ws: ServerWebSocket<ClientData>, message: string): void {
    try {
      const payload = JSON.stringify({ success: false, error: message });
      ws.send(payload);
    } catch (error) {
      customLogger.error("❌ Failed to send error response", {
        connectionId: ws.data.connectionId,
        error,
      });
    }
  }

  private handleError(ws: ServerWebSocket<ClientData>, error: unknown): void {
    const connectionId = ws.data.connectionId;
    const message = error instanceof Error ? error.message : "Invalid message";

    customLogger.error("❌ WebSocket error", {
      connectionId,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Send error to client
    this.sendError(ws, message);
  }

  async broadcast(
    message: MinecraftRedemptionData<unknown>,
    filter?: (ws: ServerWebSocket<ClientData>) => boolean
  ): Promise<void> {
    if (!this.currentClient || this.currentClient.readyState !== WebSocket.OPEN) {
      customLogger.warn("⚠️ No connected client to broadcast to");
      return;
    }

    if (filter && !filter(this.currentClient)) {
      customLogger.debug("📢 Broadcast filtered out", {
        connectionId: this.currentClient.data.connectionId,
      });
      return;
    }

    const payload = JSON.stringify(message);

    try {
      this.currentClient.send(payload);
      customLogger.debug("📢 Broadcast message sent", {
        connectionId: this.currentClient.data.connectionId,
      });
    } catch (error) {
      customLogger.error("❌ Failed to broadcast to client", {
        connectionId: this.currentClient.data.connectionId,
        error,
      });
    }
  }

  async stop(): Promise<void> {
    customLogger.info("🛑 Stopping server gracefully...");

    if (this.currentClient && this.currentClient.readyState === WebSocket.OPEN) {
      await new Promise<void>((resolve) => {
        this.currentClient!.close(1001, "Server maintenance");
        resolve();
      });
    }

    this.server.stop(true);
    this.currentClient = null;
    customLogger.success("✅ Server stopped gracefully");
  }
}

export const minecraftWebSocketServer = new MinecraftWebSocketServer();
