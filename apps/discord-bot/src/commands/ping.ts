import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/discord";

export default {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check the bot's latency"),
  async execute(interaction) {
    const sentAt = Date.now();
    await interaction.reply("Pinging...");
    await interaction.editReply(`🏓 Pong! Latency: ${Date.now() - sentAt}ms`);
  },
} satisfies Command;
