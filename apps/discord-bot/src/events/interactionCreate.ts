import { Events, MessageFlags } from "discord.js";
import type { BotEvent } from "../types/discord";
import { Sentry } from "../sentry";
import { canRunCommand } from "../lib/permissions";
import { handleTicketInteraction } from "../lib/tickets";
import { handleSetupInteraction } from "../lib/setup-wizard";

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      try {
        await command?.autocomplete?.(interaction);
      } catch (error) {
        Sentry.captureException(error);
        console.error(`[commands] Error in autocomplete for "${interaction.commandName}":`, error);
      }
      return;
    }

    // Ticket buttons and modal submits route to their own handler (which does its
    // own error handling). Dispatched purely by customId, so they survive restarts.
    if ((interaction.isButton() || interaction.isModalSubmit()) && interaction.customId.startsWith("ticket:")) {
      await handleTicketInteraction(interaction);
      return;
    }

    if ((interaction.isButton() || interaction.isAnySelectMenu()) && interaction.customId.startsWith("setup:")) {
      await handleSetupInteraction(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      // Discord knows a command the bot doesn't — deploy-commands ran against a
      // different build, or a command file failed to load. The user just sees
      // the interaction hang.
      Sentry.captureException(new Error(`No command matching "${interaction.commandName}" was found`), {
        tags: { context: "commands.unknown-command" },
      });
      console.error(`[commands] No command matching "${interaction.commandName}" was found`);
      return;
    }

    const member = interaction.inCachedGuild() ? interaction.member : null;

    if (!(await canRunCommand(member, interaction.commandName))) {
      await interaction.reply({
        content: "You don't have permission to use this command.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      Sentry.captureException(error);
      console.error(`[commands] Error executing "${interaction.commandName}":`, error);

      const payload = { content: "Something went wrong running that command.", flags: MessageFlags.Ephemeral } as const;
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
  },
} satisfies BotEvent<typeof Events.InteractionCreate>;
