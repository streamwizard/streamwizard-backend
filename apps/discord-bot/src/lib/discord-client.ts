import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";

// GuildMembers is privileged (welcome messages). GuildMessages,
// GuildMessageReactions and GuildVoiceStates are NOT privileged and power the
// activity tracker (message/reaction/voice counts). We deliberately omit
// MessageContent — we only count messages, never read their text. Partials let
// reaction events fire on uncached messages.
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel],
});

client.commands = new Collection();
