import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { supabase } from "@repo/supabase";
import { getUserDailyRows, getUserRank, getUserTotals } from "@repo/supabase/queries/discord-activity";
import type { Command } from "../types/discord";
import { formatDuration, formatNumber, yearRange } from "../lib/activity-format";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default {
  data: new SlashCommandBuilder()
    .setName("recap")
    .setDescription("Your year on this server, wrapped up")
    .addUserOption((opt) => opt.setName("user").setDescription("Whose recap to show (defaults to you)"))
    .addIntegerOption((opt) =>
      opt.setName("year").setDescription("Which year (defaults to this one)").setMinValue(2020).setMaxValue(2100)
    ),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command only works in a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const target = interaction.options.getUser("user") ?? interaction.user;
    const year = interaction.options.getInteger("year") ?? new Date().getUTCFullYear();
    const { from, to } = yearRange(year);

    await interaction.deferReply();

    const [totals, msgRank, voiceRank, rows] = await Promise.all([
      getUserTotals(supabase, interaction.guildId, target.id, from, to),
      getUserRank(supabase, interaction.guildId, target.id, "messages", from, to),
      getUserRank(supabase, interaction.guildId, target.id, "voice", from, to),
      getUserDailyRows(supabase, interaction.guildId, target.id, from, to),
    ]);

    if (rows.length === 0) {
      await interaction.editReply(
        target.id === interaction.user.id
          ? `No ${year} recap for you yet — nothing tracked. There's still time. 👀`
          : `No ${year} recap for ${target} — nothing tracked.`
      );
      return;
    }

    // Most active month by messages.
    const byMonth = new Array(12).fill(0);
    let activeDays = 0;
    for (const row of rows) {
      if (row.messages_sent > 0 || row.voice_seconds > 0 || row.reactions_added > 0) activeDays++;
      const month = new Date(`${row.activity_date}T00:00:00Z`).getUTCMonth();
      byMonth[month] += row.messages_sent;
    }
    const topMonthIdx = byMonth.indexOf(Math.max(...byMonth));
    const topMonth = byMonth[topMonthIdx] > 0 ? MONTHS[topMonthIdx] ?? "—" : "—";

    const rankText = (r: { rank: number; ranked_members: number }) =>
      r.rank > 0 ? `#${r.rank} of ${r.ranked_members}` : "—";

    const embed = new EmbedBuilder()
      .setTitle(`${year} Recap — ${target.username}`)
      .setDescription(`Here's how ${target.id === interaction.user.id ? "your" : `${target.username}'s`} year looked.`)
      .setColor(0x5865f2)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "💬 Messages", value: `${formatNumber(totals.messages_sent)}  (${rankText(msgRank)})`, inline: true },
        { name: "🎙️ Voice time", value: `${formatDuration(totals.voice_seconds)}  (${rankText(voiceRank)})`, inline: true },
        { name: "📅 Active days", value: formatNumber(activeDays), inline: true },
        { name: "👍 Reactions given", value: formatNumber(totals.reactions_added), inline: true },
        { name: "🔥 Reactions received", value: formatNumber(totals.reactions_received), inline: true },
        { name: "📈 Busiest month", value: topMonth, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
} satisfies Command;
