import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { supabase } from "@repo/supabase";
import { getUserRank, getUserTotals } from "@repo/supabase/queries/discord-activity";
import type { Command } from "../types/discord";
import { formatDuration, formatNumber, resolveTimeframe, TIMEFRAME_CHOICES, type Timeframe } from "../lib/activity-format";

export default {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("See a member's activity stats and rank")
    .addUserOption((opt) => opt.setName("user").setDescription("Whose stats to show (defaults to you)"))
    .addStringOption((opt) =>
      opt.setName("timeframe").setDescription("Time window (defaults to last 30 days)").addChoices(...TIMEFRAME_CHOICES)
    ),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command only works in a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const target = interaction.options.getUser("user") ?? interaction.user;
    const tf = (interaction.options.getString("timeframe") as Timeframe | null) ?? "30d";
    const { from, to, label } = resolveTimeframe(tf);

    await interaction.deferReply();

    const [totals, msgRank, voiceRank] = await Promise.all([
      getUserTotals(supabase, interaction.guildId, target.id, from, to),
      getUserRank(supabase, interaction.guildId, target.id, "messages", from, to),
      getUserRank(supabase, interaction.guildId, target.id, "voice", from, to),
    ]);

    const noActivity = totals.messages_sent === 0 && totals.reactions_added === 0 && totals.reactions_received === 0 && totals.voice_seconds === 0;
    if (noActivity) {
      await interaction.editReply(
        target.id === interaction.user.id
          ? `No activity tracked for you in ${label} yet. Go say something. 👀`
          : `No activity tracked for ${target} in ${label} yet.`
      );
      return;
    }

    const rankText = (r: { rank: number; ranked_members: number }) =>
      r.rank > 0 ? `#${r.rank} of ${r.ranked_members}` : "—";

    const embed = new EmbedBuilder()
      .setTitle(`Activity — ${target.username}`)
      .setDescription(`Stats for ${label}.`)
      .setColor(0x5865f2)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "💬 Messages", value: `${formatNumber(totals.messages_sent)}  (${rankText(msgRank)})`, inline: true },
        { name: "🎙️ Voice", value: `${formatDuration(totals.voice_seconds)}  (${rankText(voiceRank)})`, inline: true },
        { name: "​", value: "​", inline: true },
        { name: "👍 Reactions given", value: formatNumber(totals.reactions_added), inline: true },
        { name: "🔥 Reactions received", value: formatNumber(totals.reactions_received), inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
} satisfies Command;
