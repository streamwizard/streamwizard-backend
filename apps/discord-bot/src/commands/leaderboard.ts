import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { supabase } from "@repo/supabase";
import { getLeaderboard, type LeaderboardMetric } from "@repo/supabase/queries/discord-activity";
import type { Command } from "../types/discord";
import {
  formatMetricValue,
  MEDALS,
  METRIC_CHOICES,
  METRIC_LABEL,
  resolveTimeframe,
  TIMEFRAME_CHOICES,
  type Timeframe,
} from "../lib/activity-format";

export default {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("See the most active members")
    .addStringOption((opt) =>
      opt.setName("metric").setDescription("What to rank by (defaults to messages)").addChoices(...METRIC_CHOICES)
    )
    .addStringOption((opt) =>
      opt.setName("timeframe").setDescription("Time window (defaults to last 30 days)").addChoices(...TIMEFRAME_CHOICES)
    ),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command only works in a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const metric = (interaction.options.getString("metric") as LeaderboardMetric | null) ?? "messages";
    const tf = (interaction.options.getString("timeframe") as Timeframe | null) ?? "30d";
    const { from, to, label } = resolveTimeframe(tf);

    await interaction.deferReply();

    const rows = await getLeaderboard(supabase, interaction.guildId, metric, from, to, 10);
    if (rows.length === 0) {
      await interaction.editReply(`No ${METRIC_LABEL[metric]} tracked in ${label} yet.`);
      return;
    }

    const lines = rows.map((row, i) => {
      const rank = MEDALS[i] ?? `**${i + 1}.**`;
      return `${rank} <@${row.user_id}> — ${formatMetricValue(metric, row.total)}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`Top members — ${METRIC_LABEL[metric]}`)
      .setDescription(`${label}\n\n${lines.join("\n")}`)
      .setColor(0x5865f2)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
} satisfies Command;
