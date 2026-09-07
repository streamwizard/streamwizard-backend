import { Events } from "discord.js";
import { handleVoiceStateUpdate } from "../lib/activity-tracker";
import type { BotEvent } from "../types/discord";

export default {
  name: Events.VoiceStateUpdate,
  execute(oldState, newState) {
    void handleVoiceStateUpdate(oldState, newState);
  },
} satisfies BotEvent<typeof Events.VoiceStateUpdate>;
