import { Events } from "discord.js";
import { reconcileVoiceSessions } from "../lib/activity-tracker";
import { Sentry } from "../sentry";
import type { BotEvent } from "../types/discord";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`[discord] Logged in as ${client.user.tag}`);

    // Close any voice sessions left open by a previous run and start fresh ones
    // for members currently in voice.
    try {
      await reconcileVoiceSessions(client);
    } catch (error) {
      Sentry.captureException(error);
      console.error("[discord] Failed to reconcile voice sessions on startup:", error);
    }
  },
} satisfies BotEvent<typeof Events.ClientReady>;
