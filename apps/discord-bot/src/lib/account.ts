import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { supabase } from "@repo/supabase";
import { getDiscordIntegrationByDiscordUserId } from "@repo/supabase/queries/discord";
import { env } from "./env";

const LINK_URL = `${env.NEXT_PUBLIC_BASE_URL}/auth/link/discord`;

/**
 * Resolves the StreamWizard user id for the interacting Discord user.
 * Replies with a "not linked" prompt and returns null when no account is linked,
 * so callers can `if (!userId) return;` without duplicating the unlinked-account UX.
 */
export async function requireLinkedAccount(interaction: ChatInputCommandInteraction): Promise<string | null> {
  const { data } = await getDiscordIntegrationByDiscordUserId(supabase, interaction.user.id);

  if (data?.user_id) return data.user_id;

  const button = new ButtonBuilder().setLabel("Link your account").setStyle(ButtonStyle.Link).setURL(LINK_URL);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  await interaction.reply({
    content: "Your Discord account is not connected to StreamWizard yet.",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });

  return null;
}
