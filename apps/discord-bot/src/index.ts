import { Sentry } from "./sentry";
process.on("uncaughtException", (err) => { reportFatal(err, "discord-bot"); });
process.on("unhandledRejection", (reason) => { Sentry.captureException(reason); });

import { flushSentry, reportFatal } from "@repo/sentry";
import { client } from "./lib/discord-client";
import { env } from "./lib/env";
import { loadCommands } from "./handlers/commandHandler";
import { loadEvents } from "./handlers/eventHandler";
import { shutdownTracker } from "./lib/activity-tracker";

async function main() {
  await loadCommands(client);
  await loadEvents(client);

  // Flush buffered activity counts and close open voice sessions before exit so
  // we don't lose in-flight data on deploys/restarts.
  const shutdown = async () => {
    await shutdownTracker();
    await client.destroy();
    await flushSentry();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await client.login(env.DISCORD_BOT_TOKEN);
}

main().catch(async (error) => {
  // A rejection handled here never reaches the unhandledRejection hook above,
  // so capture it explicitly or a failed startup is invisible in Sentry.
  console.error("❌ Failed to start bot:", error);
  Sentry.captureException(error);
  await flushSentry();
  process.exit(1);
});
