import type { AutoSwitcherStatus } from "@repo/schemas";

const MAX_DELAY_MS = 30_000;

// Bot-role client pushing streamwizard.auto_switcher_status into the user's
// room, so the Auto Switcher status card sees live engine state. Separate
// connection from the consumer feed: bots are send-only, consumers
// receive-only, and ws-server keeps those roles distinct.
export class StatusPublisher {
  private ws: WebSocket | null = null;
  private delay = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;

  constructor(
    private url: string,
    private serviceKey: string,
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

  publish(userId: string, status: AutoSwitcherStatus): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ userId, type: "streamwizard.auto_switcher_status", payload: status }));
    }
  }

  private dial(): void {
    const ws = new WebSocket(`${this.url}/ws?role=bot&source=obs-auto-switcher`, {
      // @ts-expect-error Bun WebSocket supports headers in options
      headers: { Authorization: `Bearer ${this.serviceKey}` },
    });
    this.ws = ws;

    ws.onopen = () => {
      console.log("[status-publisher] connected");
      this.delay = 1000;
    };

    ws.onclose = () => {
      if (this.stopping) return;
      console.log(`[status-publisher] disconnected — retrying in ${this.delay}ms`);
      this.retryTimer = setTimeout(() => this.dial(), this.delay);
      this.delay = Math.min(this.delay * 2, MAX_DELAY_MS);
    };

    ws.onerror = () => {
      ws.close();
    };
  }
}
