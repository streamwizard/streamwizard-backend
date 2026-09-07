import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/discord";

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

export default {
  data: new SlashCommandBuilder().setName("status").setDescription("Show the bot's current status"),
  async execute(interaction) {
    const client = interaction.client;
    const embed = new EmbedBuilder()
      .setTitle("Bot Status")
      .setColor(0x5865f2)
      .addFields(
        { name: "Uptime", value: formatUptime(client.uptime ?? 0), inline: true },
        { name: "Gateway ping", value: `${client.ws.ping}ms`, inline: true },
        { name: "Servers", value: `${client.guilds.cache.size}`, inline: true },
        { name: "Commands", value: `${client.commands.size}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
