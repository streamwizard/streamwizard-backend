import { Sentry } from "./sentry";
process.on("uncaughtException", (err) => { reportFatal(err, "ws-server"); });
process.on("unhandledRejection", (reason) => { Sentry.captureException(reason); });
import "./lib/env";
import { flushSentry, reportFatal } from "@repo/sentry";
import { handleUpgrade } from "./handlers/auth";
import { websocketHandlers } from "./handlers/ws";
import { rooms } from "./rooms";
import { monitors, broadcastSnapshot, getBotSockets } from "./monitor";
import { consumers } from "./consumers";
import { isMetricsEnabled } from "@repo/metrics";
import type { ConnectionData } from "./types";

const PORT = Number(process.env.PORT ?? 8000);

const server = Bun.serve<ConnectionData>({
  port: PORT,
  fetch: handleUpgrade,
  websocket: websocketHandlers,
});

// Ping all connections every 30 s to keep them alive through Cloudflare (100 s idle timeout)
setInterval(() => {
  for (const room of rooms.values()) {
    room.publisher?.ping();
    for (const sub of room.subscribers) {
      sub.ping();
    }
  }
  for (const ws of monitors) {
    ws.ping();
  }
  for (const ws of consumers) {
    ws.ping();
  }
  // Bots too: a quiet producer (e.g. the auto-switcher status publisher with
  // nothing enabled) would otherwise idle past Cloudflare's timeout and churn
  // through reconnects.
  for (const ws of getBotSockets().values()) {
    ws.ping();
  }
}, 30_000);

// Send a room snapshot to connected monitors every 5 s
setInterval(broadcastSnapshot, 5_000);

// Without a signal handler the container is killed outright on deploy and any
// queued Sentry event dies with it.
const shutdown = async () => {
  console.log("[ws-server] shutting down");
  server.stop();
  await flushSentry();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`[ws-server] listening on port ${server.port}`);
console.log(`[metrics] ${isMetricsEnabled() ? "active — sending to " + process.env.INFLUXDB_URL : "disabled — set INFLUXDB_* env vars to enable"}`);
