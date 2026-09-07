import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder } from "discord.js";
import type { Guild, GuildMember, TextChannel } from "discord.js";
import { supabase } from "@repo/supabase";
import {
  getDiscordIntegrationByDiscordUserId,
  getGuildSettings,
  getPublicTwitchIntegrationByDiscordUserId,
  recordGuildMemberJoin,
} from "@repo/supabase/queries/discord";
import type { PublicTwitchIntegration } from "@repo/supabase/queries/discord";
import { Sentry } from "../sentry";
import { env } from "./env";

const LINK_URL = `${env.NEXT_PUBLIC_BASE_URL}/dashboard/settings/integrations`;

const BROADCASTER_TYPE_LABEL: Record<string, string> = {
  partner: "Twitch Partner",
  affiliate: "Twitch Affiliate",
};

export type ConnectionInfo = {
  isConnected: boolean;
  twitch: PublicTwitchIntegration | null;
  // StreamWizard account id for linked members, for analytics attribution.
  userId: string | null;
};

export async function getJoinNumber(member: GuildMember): Promise<number | null> {
  try {
    return await recordGuildMemberJoin(supabase, member.guild.id, member.id, member.guild.memberCount);
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[welcome] Failed to record join number for "${member.user.tag}" in "${member.guild.name}":`, error);
    return null;
  }
}

export async function getConnectionInfo(member: GuildMember): Promise<ConnectionInfo> {
  try {
    const { data, error } = await getDiscordIntegrationByDiscordUserId(supabase, member.id);
    if (error) throw error;
    if (!data) return { isConnected: false, twitch: null, userId: null };

    const twitch = await getPublicTwitchIntegrationByDiscordUserId(supabase, member.id);
    return { isConnected: true, twitch, userId: data.user_id };
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[welcome] Failed to check connection status for "${member.user.tag}":`, error);
    return { isConnected: false, twitch: null, userId: null };
  }
}

export function buildWelcomeMessage(member: GuildMember, joinNumber: number | null, connection: ConnectionInfo) {
  const { isConnected, twitch } = connection;

  const embed = new EmbedBuilder()
    .setTitle(`${member.guild.name} just got better, ${member.user.username}`)
    .setColor(0x5865f2)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  if (isConnected && twitch) {
    embed
      .setDescription(
        `Hey ${member}, welcome in! Your StreamWizard account is linked to **${twitch.twitch_username}** on Twitch, so your roles are good to go.`
      )
      .setFooter({ text: "Glad you're here.", iconURL: member.user.displayAvatarURL() });

    const broadcasterLabel = twitch.broadcaster_type ? BROADCASTER_TYPE_LABEL[twitch.broadcaster_type] : undefined;
    embed.addFields({
      name: "Twitch",
      value: `[twitch.tv/${twitch.twitch_username}](https://twitch.tv/${twitch.twitch_username})${broadcasterLabel ? ` · ${broadcasterLabel}` : ""}`,
      inline: true,
    });
  } else if (isConnected) {
    embed
      .setDescription(`Hey ${member}, welcome in. Your StreamWizard account is connected, so your roles are good to go.`)
      .setFooter({ text: "Glad you're here.", iconURL: member.user.displayAvatarURL() });
  } else {
    embed
      .setDescription(`Hey ${member}, welcome in. Connect your StreamWizard account and we'll get your roles set up.`)
      .setFooter({ text: "Not connected yet? We'll fix that.", iconURL: member.user.displayAvatarURL() });
  }

  if (joinNumber !== null) {
    embed.addFields({ name: "You're member", value: `#${joinNumber}`, inline: true });
  }

  if (isConnected) {
    return { embeds: [embed] };
  }

  const button = new ButtonBuilder().setLabel("Connect your account").setStyle(ButtonStyle.Link).setURL(LINK_URL);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  return { embeds: [embed], components: [row] };
}

export async function getGuildWelcomeSettings(guild: Guild) {
  try {
    return await getGuildSettings(supabase, guild.id);
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[welcome] Failed to load settings for "${guild.name}":`, error);
    return null;
  }
}

export async function resolveWelcomeChannel(guild: Guild, channelId?: string | null): Promise<TextChannel | null> {
  const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : guild.systemChannel;

  return channel?.type === ChannelType.GuildText ? channel : null;
}
