import { Events } from "discord.js";
import { recordReaction } from "../lib/activity-tracker";
import type { BotEvent } from "../types/discord";

export default {
  name: Events.MessageReactionAdd,
  execute(reaction, user) {
    void recordReaction(reaction, user);
  },
} satisfies BotEvent<typeof Events.MessageReactionAdd>;
