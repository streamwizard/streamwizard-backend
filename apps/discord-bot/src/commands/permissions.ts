import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { supabase } from "@repo/supabase";
import { addCommandRole, getCommandRoles, getGuildCommandPermissions, removeCommandRole } from "@repo/supabase/queries/discord";
import type { Command } from "../types/discord";
import { invalidateCommandPermissionCache } from "../lib/permissions";

export default {
  data: new SlashCommandBuilder()
    .setName("permissions")
    .setDescription("Restrict which roles can use a command in this server")
    // Hides the command from members without Manage Server in their client.
    // The actual enforcement is the server-owner check in execute() below —
    // Discord has no "owner" permission flag to set here.
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Allow a role to use a command")
        .addStringOption((opt) =>
          opt.setName("command").setDescription("Command name, e.g. status").setRequired(true).setAutocomplete(true)
        )
        .addRoleOption((opt) => opt.setName("role").setDescription("Role allowed to use it").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a role's access to a command")
        .addStringOption((opt) => opt.setName("command").setDescription("Command name").setRequired(true).setAutocomplete(true))
        .addRoleOption((opt) => opt.setName("role").setDescription("Role to remove").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Show role restrictions for a command")
        .addStringOption((opt) =>
          opt.setName("command").setDescription("Command name (omit to see all)").setRequired(false).setAutocomplete(true)
        )
    ),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = [...interaction.client.commands.keys()]
      .filter((name) => name.includes(focused))
      .slice(0, 25)
      .map((name) => ({ name, value: name }));

    await interaction.respond(choices);
  },
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    // Discord has no "owner" permission flag, so this can't be expressed via
    // setDefaultMemberPermissions — it has to be checked here instead.
    if (interaction.user.id !== interaction.guild.ownerId) {
      await interaction.reply({
        content: "Only the server owner can manage command permissions.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const commandName = interaction.options.getString("command")?.toLowerCase();

    if (commandName && !interaction.client.commands.has(commandName)) {
      await interaction.reply({ content: `Unknown command \`/${commandName}\`.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === "set") {
      const role = interaction.options.getRole("role", true);
      await addCommandRole(supabase, interaction.guildId, commandName!, role.id);
      invalidateCommandPermissionCache(interaction.guildId, commandName!);

      await interaction.reply({
        content: `✅ <@&${role.id}> can now use \`/${commandName}\`.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "remove") {
      const role = interaction.options.getRole("role", true);
      await removeCommandRole(supabase, interaction.guildId, commandName!, role.id);
      invalidateCommandPermissionCache(interaction.guildId, commandName!);

      await interaction.reply({
        content: `✅ Removed <@&${role.id}>'s access to \`/${commandName}\`.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // view
    if (commandName) {
      const rows = await getCommandRoles(supabase, interaction.guildId, commandName);
      const content =
        rows.length === 0
          ? `\`/${commandName}\` has no role restrictions — open to everyone.`
          : `\`/${commandName}\` is restricted to: ${rows.map((row) => `<@&${row.role_id}>`).join(", ")}`;

      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      return;
    }

    const rows = await getGuildCommandPermissions(supabase, interaction.guildId);
    if (rows.length === 0) {
      await interaction.reply({ content: "No commands are role-restricted in this server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const byCommand = new Map<string, string[]>();
    for (const row of rows) {
      byCommand.set(row.command_name, [...(byCommand.get(row.command_name) ?? []), row.role_id]);
    }

    const lines = [...byCommand.entries()].map(
      ([command, roleIds]) => `\`/${command}\` → ${roleIds.map((roleId) => `<@&${roleId}>`).join(", ")}`
    );
    await interaction.reply({ content: lines.join("\n"), flags: MessageFlags.Ephemeral });
  },
} satisfies Command;
