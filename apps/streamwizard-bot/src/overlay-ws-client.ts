import type { BotBroadcastMessage } from "@repo/types";

const MAX_DELAY_MS = 30_000;

class OverlayWsClient {
  private ws: WebSocket | null = null;
  private url = "";
  private serviceKey = "";
  private delay = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;

  connect(url: string, serviceKey: string): void {
    this.url = url;
    this.serviceKey = serviceKey;
    this.stopping = false;
    this.dial();
  }

  send(message: BotBroadcastMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.stopping = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
  }

  private dial(): void {
    // `source` labels this connection in ws-server's monitor view — several
    // bots connect at once (this one plus each ingest node's control plane).
    const ws = new WebSocket(`${this.url}/ws?role=bot&source=streamwizard-bot`, {
      // @ts-expect-error Bun WebSocket supports headers in options
      headers: { Authorization: `Bearer ${this.serviceKey}` },
    });
    this.ws = ws;

    ws.onopen = () => {
      console.log("[overlay-ws-client] connected");
      this.delay = 1000;
    };

    ws.onclose = () => {
      if (this.stopping) return;
      console.log(`[overlay-ws-client] disconnected — retrying in ${this.delay}ms`);
      this.retryTimer = setTimeout(() => this.dial(), this.delay);
      this.delay = Math.min(this.delay * 2, MAX_DELAY_MS);
    };

    ws.onerror = () => {
      ws.close();
    };
  }
}

export const overlayWsClient = new OverlayWsClient();
