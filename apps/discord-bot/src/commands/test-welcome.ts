import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { buildWelcomeMessage, getConnectionInfo, getGuildWelcomeSettings, getJoinNumber, resolveWelcomeChannel } from "../lib/welcome";
import type { Command } from "../types/discord";

export default {
  data: new SlashCommandBuilder()
    .setName("test-welcome")
    .setDescription("Post a mock welcome message to preview how it looks")
    // Hides the command from members without Manage Server in their client;
    // Discord also enforces this server-side for users without an override.
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((opt) => opt.setName("member").setDescription("Member to use in the mock message (defaults to you)").setRequired(false)),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const member = interaction.options.getMember("member") ?? interaction.member;

    const settings = await getGuildWelcomeSettings(interaction.guild);
    const channel = await resolveWelcomeChannel(interaction.guild, settings?.welcome_channel_id);

    if (!channel) {
      await interaction.reply({
        content: "No usable welcome channel is configured. Run `/setup` to set one, or set a system channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const [joinNumber, connection] = await Promise.all([getJoinNumber(member), getConnectionInfo(member)]);
    await channel.send(buildWelcomeMessage(member, joinNumber, connection));

    const disabledNote = settings?.welcome_enabled === false ? "\n⚠️ Welcome messages are currently disabled, so this won't fire on real joins." : "";
    await interaction.reply({
      content: `✅ Sent a mock welcome message in <#${channel.id}>.${disabledNote}`,
      flags: MessageFlags.Ephemeral,
    });
  },
} satisfies Command;
