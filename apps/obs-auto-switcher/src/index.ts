import { Sentry } from "./sentry";
process.on("uncaughtException", (err) => {
  reportFatal(err, "obs-auto-switcher");
});
process.on("unhandledRejection", (reason) => {
  Sentry.captureException(reason);
});

import { flushSentry, reportFatal } from "@repo/sentry";
import { env } from "./lib/env";
import { ConfigStore } from "./config-store";
import { StatsFeed } from "./stats-feed";
import { StatusPublisher } from "./status-publisher";
import { Engine } from "./engine/engine";

// IRL auto scene-switcher. Consumes the 1 Hz ingest stats feed from
// ws-server, runs a per-user threshold/streak state machine, and drives
// cloud OBS scenes through each node's internal command endpoint.
//
// Run exactly ONE replica: streaks/overrides/session selection live in
// memory, and two engines would race conflicting scene switches.

const statusPublisher = new StatusPublisher(env.WS_SERVER_URL, env.SUPABASE_SECRET_KEY);
const engine = new Engine(statusPublisher);
const configStore = new ConfigStore((userId, config) => engine.onConfigChanged(userId, config));

const statsFeed = new StatsFeed(env.WS_SERVER_URL, env.CONSUMER_SECRET, {
  onIngestStats: (userId, payload) => engine.onStats(userId, payload),
  onConfigPush: (_userId, payload) => configStore.applyPush(payload),
  onSessionEnded: (userId, payload) => engine.onSessionEnded(userId, payload),
});

await configStore.start();
statusPublisher.connect();
statsFeed.connect();
engine.start();

console.log(`[obs-auto-switcher] running — ${configStore.size} enabled config(s) loaded`);

// Liveness probe (docker healthcheck / alert-worker).
Bun.serve({
  port: Number(process.env.PORT ?? 8010),
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, monitors: engine.monitorCount });
    }
    return new Response("Not Found", { status: 404 });
  },
});

const shutdown = async () => {
  console.log("[obs-auto-switcher] shutting down");
  engine.stop();
  configStore.stop();
  statsFeed.disconnect();
  statusPublisher.disconnect();
  await flushSentry();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
