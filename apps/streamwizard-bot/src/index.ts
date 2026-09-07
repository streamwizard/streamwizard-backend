import { Sentry } from "./sentry";
process.on("uncaughtException", (err) => { reportFatal(err, "streamwizard-bot"); });
process.on("unhandledRejection", (reason) => { Sentry.captureException(reason); });
import { flushSentry, reportFatal } from "@repo/sentry";
import { handlers } from "./handlers/eventHandler";
import { TwitchEventSubReceiver } from "@repo/twitch-eventsub";
import { env } from "./lib/env";
import { createEventSubAlerter } from "./lib/eventsub-alerter";
import { overlayWsClient } from "./overlay-ws-client";
import { isMetricsEnabled } from "@repo/metrics";

const production = "wss://eventsub.wss.twitch.tv/ws";
const websocketUrl = env.WS_SERVER_URL;

async function main() {
  try {
    if (websocketUrl) {
      overlayWsClient.connect(websocketUrl, env.SUPABASE_SECRET_KEY);
    }

    const EventSubReceiver = new TwitchEventSubReceiver(handlers, {
      wsUrl: production,
      conduitId: env.TWITCH_CONDUIT_ID,
      onLifecycleEvent: createEventSubAlerter(),
    });

    const shutdown = async () => {
      overlayWsClient.disconnect();
      await EventSubReceiver.disconnect();
      await flushSentry();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    console.log(`[metrics] ${isMetricsEnabled() ? "active — sending to " + process.env.INFLUXDB_URL : "disabled — set INFLUXDB_* env vars to enable"}`);
    await EventSubReceiver.connect();
  } catch (error) {
    // Caught here, so the unhandledRejection hook above never sees it —
    // capture explicitly or a failed startup is invisible in Sentry.
    console.error("❌ Failed to start receiver:", error);
    Sentry.captureException(error);
    await flushSentry();
    process.exit(1);
  }
}

main();
