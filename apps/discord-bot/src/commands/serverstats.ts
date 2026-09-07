import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { supabase } from "@repo/supabase";
import { getLeaderboard, getServerTotals } from "@repo/supabase/queries/discord-activity";
import type { Command } from "../types/discord";
import { formatDuration, formatNumber, MEDALS, resolveTimeframe, TIMEFRAME_CHOICES, type Timeframe } from "../lib/activity-format";

export default {
  data: new SlashCommandBuilder()
    .setName("serverstats")
    .setDescription("Server-wide activity overview")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt.setName("timeframe").setDescription("Time window (defaults to last 30 days)").addChoices(...TIMEFRAME_CHOICES)
    ),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command only works in a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const tf = (interaction.options.getString("timeframe") as Timeframe | null) ?? "30d";
    const { from, to, label } = resolveTimeframe(tf);

    await interaction.deferReply();

    const [totals, topMessages, topVoice] = await Promise.all([
      getServerTotals(supabase, interaction.guildId, from, to),
      getLeaderboard(supabase, interaction.guildId, "messages", from, to, 3),
      getLeaderboard(supabase, interaction.guildId, "voice", from, to, 3),
    ]);

    if (totals.active_members === 0) {
      await interaction.editReply(`No activity tracked for ${label} yet.`);
      return;
    }

    const topList = (rows: { user_id: string; total: number }[], fmt: (n: number) => string) =>
      rows.length > 0 ? rows.map((r, i) => `${MEDALS[i] ?? `${i + 1}.`} <@${r.user_id}> — ${fmt(r.total)}`).join("\n") : "—";

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.guild?.name ?? "Server"} — activity`)
      .setDescription(`Overview for ${label}.`)
      .setColor(0x5865f2)
      .addFields(
        { name: "👥 Active members", value: formatNumber(totals.active_members), inline: true },
        { name: "💬 Messages", value: formatNumber(totals.messages_sent), inline: true },
        { name: "🎙️ Voice time", value: formatDuration(totals.voice_seconds), inline: true },
        { name: "👍 Reactions", value: `${formatNumber(totals.reactions_added)} given`, inline: true },
        { name: "​", value: "​", inline: true },
        { name: "​", value: "​", inline: true },
        { name: "Top chatters", value: topList(topMessages, formatNumber), inline: true },
        { name: "Top in voice", value: topList(topVoice, formatDuration), inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
} satisfies Command;
