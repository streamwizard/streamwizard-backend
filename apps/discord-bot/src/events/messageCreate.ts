import { Events } from "discord.js";
import { recordMessage } from "../lib/activity-tracker";
import type { BotEvent } from "../types/discord";

export default {
  name: Events.MessageCreate,
  execute(message) {
    void recordMessage(message);
  },
} satisfies BotEvent<typeof Events.MessageCreate>;
