import type { IngestStatsPayload } from "@repo/types";
import { trackAutoSwitcherEvent } from "@repo/metrics";

const MAX_DELAY_MS = 30_000;

export interface ConsumerMessage {
  userId: string;
  type: string;
  payload: unknown;
  ts?: number;
}

export interface StatsFeedHandlers {
  onIngestStats: (userId: string, payload: IngestStatsPayload) => void;
  onConfigPush: (userId: string, payload: unknown) => void;
  onSessionEnded?: (userId: string, payload: unknown) => void;
}

// Consumer-role client on ws-server: receives every user's ingest stats and
// config pushes, server-to-server (same reconnect shape as the bot clients —
// see apps/streamwizard-bot/src/overlay-ws-client.ts).
export class StatsFeed {
  private ws: WebSocket | null = null;
  private delay = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;

  constructor(
    private url: string,
    private consumerSecret: string,
    private handlers: StatsFeedHandlers,
  ) {}

  connect(): void {
    this.stopping = false;
    this.dial();
  }

  disconnect(): void {
    this.stopping = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
  }

  private dial(): void {
    const types = ["streamwizard.ingest_stats", "streamwizard.auto_switcher_config", "streamwizard.ingest_session_ended"].join(",");
    const ws = new WebSocket(`${this.url}/ws?role=consumer&source=obs-auto-switcher&types=${encodeURIComponent(types)}`, {
      // @ts-expect-error Bun WebSocket supports headers in options
      headers: { Authorization: `Bearer ${this.consumerSecret}` },
    });
    this.ws = ws;

    ws.onopen = () => {
      console.log("[stats-feed] connected");
      this.delay = 1000;
    };

    ws.onmessage = (event) => {
      let msg: ConsumerMessage;
      try {
        msg = JSON.parse(String(event.data)) as ConsumerMessage;
      } catch {
        return;
      }
      if (typeof msg.userId !== "string" || typeof msg.type !== "string") return;

      switch (msg.type) {
        case "streamwizard.ingest_stats":
          this.handlers.onIngestStats(msg.userId, msg.payload as IngestStatsPayload);
          break;
        case "streamwizard.auto_switcher_config":
          this.handlers.onConfigPush(msg.userId, msg.payload);
          break;
        case "streamwizard.ingest_session_ended":
          this.handlers.onSessionEnded?.(msg.userId, msg.payload);
          break;
      }
    };

    ws.onclose = () => {
      if (this.stopping) return;
      trackAutoSwitcherEvent("feed_reconnect");
      console.log(`[stats-feed] disconnected — retrying in ${this.delay}ms`);
      this.retryTimer = setTimeout(() => this.dial(), this.delay);
      this.delay = Math.min(this.delay * 2, MAX_DELAY_MS);
    };

    ws.onerror = () => {
      ws.close();
    };
  }
}
