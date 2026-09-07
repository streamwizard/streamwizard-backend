import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { startSetupWizard } from "../lib/setup-wizard";
import type { Command } from "../types/discord";

export default {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure StreamWizard for this server")
    // Hides the command from members without Manage Server in their client;
    // Discord also enforces this server-side for users without an override.
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await startSetupWizard(interaction);
  },
} satisfies Command;
