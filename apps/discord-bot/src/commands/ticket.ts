import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { supabase } from "@repo/supabase";
import { getTicketSettings, upsertTicketSettings } from "@repo/supabase/queries/tickets";
import type { Command } from "../types/discord";
import { buildPanelMessage, closeTicketChannel, isStaff } from "../lib/tickets";

export default {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage the support ticket system")
    // Hides setup/settings from members without Manage Server; close is staff-gated in execute().
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Configure ticketing and post the ticket panel")
        .addRoleOption((opt) => opt.setName("staff-role").setDescription("Role that can see and manage tickets").setRequired(true))
        .addChannelOption((opt) =>
          opt
            .setName("category")
            .setDescription("Category that new ticket channels are created under")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("panel-channel")
            .setDescription("Channel to post the 'Create Ticket' panel in")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("log-channel")
            .setDescription("Optional channel to log closed tickets in")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) => sub.setName("close").setDescription("Close the ticket in this channel"))
    .addSubcommand((sub) => sub.setName("settings").setDescription("Show the current ticket configuration")),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      const staffRole = interaction.options.getRole("staff-role", true);
      const category = interaction.options.getChannel("category", true);
      const panelChannel = interaction.options.getChannel("panel-channel", true, [ChannelType.GuildText]);
      const logChannel = interaction.options.getChannel("log-channel", false, [ChannelType.GuildText]);

      const panelMessage = await panelChannel.send(buildPanelMessage());

      await upsertTicketSettings(supabase, interaction.guildId, {
        enabled: true,
        staff_role_id: staffRole.id,
        category_id: category.id,
        panel_channel_id: panelChannel.id,
        panel_message_id: panelMessage.id,
        log_channel_id: logChannel?.id ?? null,
      });

      await interaction.reply({
        content: `✅ Ticketing is set up. Panel posted in <#${panelChannel.id}>, staff role <@&${staffRole.id}>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "close") {
      const settings = await getTicketSettings(supabase, interaction.guildId);
      if (!isStaff(interaction.member, settings)) {
        await interaction.reply({ content: "Only staff can close tickets.", flags: MessageFlags.Ephemeral });
        return;
      }

      if (interaction.channel?.type !== ChannelType.GuildText) {
        await interaction.reply({ content: "This isn't a ticket channel.", flags: MessageFlags.Ephemeral });
        return;
      }

      // Acknowledge before deleting the channel, otherwise the reply target disappears.
      await interaction.reply({ content: "Closing this ticket…", flags: MessageFlags.Ephemeral });
      const closed = await closeTicketChannel(interaction.channel, interaction.member);
      if (!closed) {
        await interaction.editReply({ content: "This channel isn't a tracked ticket." });
      }
      return;
    }

    // settings
    const settings = await getTicketSettings(supabase, interaction.guildId);
    if (!settings) {
      await interaction.reply({ content: "Ticketing isn't set up yet. Run `/ticket setup`.", flags: MessageFlags.Ephemeral });
      return;
    }

    const lines = [
      `**Status:** ${settings.enabled ? "enabled" : "disabled"}`,
      `**Staff role:** ${settings.staff_role_id ? `<@&${settings.staff_role_id}>` : "not set"}`,
      `**Category:** ${settings.category_id ? `<#${settings.category_id}>` : "not set"}`,
      `**Panel channel:** ${settings.panel_channel_id ? `<#${settings.panel_channel_id}>` : "not set"}`,
      `**Log channel:** ${settings.log_channel_id ? `<#${settings.log_channel_id}>` : "not set"}`,
      `**Tickets opened:** ${settings.ticket_counter}`,
    ];
    await interaction.reply({ content: lines.join("\n"), flags: MessageFlags.Ephemeral });
  },
} satisfies Command;
