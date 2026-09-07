import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/discord";

const MAX_BULK_DELETE = 100;
// Discord's bulk-delete endpoint refuses messages older than 14 days.
const MAX_BULK_DELETE_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export default {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete messages from this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) =>
      opt
        .setName("amount")
        .setDescription("Number of messages to delete (omit to clear everything Discord allows)")
        .setMinValue(1)
        .setMaxValue(MAX_BULK_DELETE)
    ),
  async execute(interaction) {
    const channel = interaction.channel;

    if (!interaction.inCachedGuild() || !channel || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({ content: "This command can only be used in a server text channel.", flags: MessageFlags.Ephemeral });
      return;
    }

    const amount = interaction.options.getInteger("amount");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let totalDeleted = 0;
    let remaining = amount ?? Infinity;

    while (remaining > 0) {
      const batchSize = Math.min(remaining, MAX_BULK_DELETE);
      const messages = await channel.messages.fetch({ limit: batchSize });
      if (messages.size === 0) break;

      const deletable = messages.filter((message) => Date.now() - message.createdTimestamp < MAX_BULK_DELETE_AGE_MS);
      if (deletable.size > 0) {
        const deleted = await channel.bulkDelete(deletable, true);
        totalDeleted += deleted.size;
      }

      remaining -= messages.size;

      // Ran into messages older than 14 days — can't bulk-delete past this point.
      if (deletable.size < messages.size) break;
    }

    await interaction.editReply(
      totalDeleted === 0
        ? "No messages were deleted — none found, or they're all older than 14 days."
        : `🧹 Deleted ${totalDeleted} message${totalDeleted === 1 ? "" : "s"}.`
    );
  },
} satisfies Command;
