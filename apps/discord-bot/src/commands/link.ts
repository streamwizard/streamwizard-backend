import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder } from "discord.js";
import { supabase } from "@repo/supabase";
import { getDiscordIntegrationByDiscordUserId } from "@repo/supabase/queries/discord";
import type { Command } from "../types/discord";
import { env } from "../lib/env";

const LINK_URL = `${env.NEXT_PUBLIC_BASE_URL}/auth/link/discord`;

export default {
  data: new SlashCommandBuilder().setName("link").setDescription("Link your Discord account to StreamWizard"),
  async execute(interaction) {
    const { data: existing } = await getDiscordIntegrationByDiscordUserId(supabase, interaction.user.id);

    if (existing) {
      await interaction.reply({
        content: `Already linked as **${existing.discord_username}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const button = new ButtonBuilder().setLabel("Link your account").setStyle(ButtonStyle.Link).setURL(LINK_URL);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await interaction.reply({
      content: "Your Discord account is not connected to StreamWizard yet.",
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },
} satisfies Command;
