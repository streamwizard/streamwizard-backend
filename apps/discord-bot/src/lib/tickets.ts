import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type {
  ButtonInteraction,
  GuildMember,
  ModalSubmitInteraction,
  TextChannel,
} from "discord.js";
import { supabase } from "@repo/supabase";
import { getDiscordIntegrationByDiscordUserId } from "@repo/supabase/queries/discord";
import {
  claimTicket,
  closeTicket,
  createTicket,
  getTicketByChannelId,
  getTicketOpenerProfile,
  getTicketSettings,
  nextTicketNumber,
  setTicketGithubIssue,
  type DiscordTicket,
  type DiscordTicketCategory,
  type DiscordTicketSettings,
  type TicketOpenerProfile,
} from "@repo/supabase/queries/tickets";
import { createTicketIssue, getInstallationOctokit } from "@repo/github-api";
import { env } from "./env";
import { Sentry } from "../sentry";
import { TWITCH_PURPLE } from "./branding";

// customId namespace for ticket component interactions. interactionCreate routes
// anything starting with "ticket:" here. Handlers are stateless — they look the
// ticket up by channel id — so buttons keep working across bot restarts.
export const TICKET_IDS = {
  create: "ticket:create",
  submit: "ticket:submit",
  claim: "ticket:claim",
  close: "ticket:close",
  closeConfirm: "ticket:close-confirm",
  closeCancel: "ticket:close-cancel",
  github: "ticket:github",
} as const;

const FIELD_IDS = {
  subject: "subject",
  description: "description",
  category: "category",
} as const;

const CATEGORY_CHOICES: { label: string; value: DiscordTicketCategory; description: string; emoji: string }[] = [
  { label: "Bug", value: "bug", description: "Something is broken or not working", emoji: "🐛" },
  { label: "Feature", value: "feature", description: "Request a new feature or improvement", emoji: "✨" },
  { label: "Support", value: "support", description: "Get help with using StreamWizard", emoji: "💬" },
  { label: "Other", value: "other", description: "Anything else", emoji: "📨" },
];


function categoryLabel(category: DiscordTicketCategory): string {
  const choice = CATEGORY_CHOICES.find((c) => c.value === category);
  return choice ? `${choice.emoji} ${choice.label}` : category;
}

// Staff = anyone with the configured staff role, or anyone who can Manage Server
// (so admins always have access even before a staff role is set).
export function isStaff(member: GuildMember, settings: DiscordTicketSettings | null): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return Boolean(settings?.staff_role_id && member.roles.cache.has(settings.staff_role_id));
}

// The persistent panel members click to open a ticket.
export function buildPanelMessage() {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("Need a hand?")
    .setDescription(
      "Open a support ticket and our team will help you out. Click the button below to get started — we'll spin up a private channel just for you."
    )
    .setFooter({ text: "StreamWizard Support" });

  const button = new ButtonBuilder()
    .setCustomId(TICKET_IDS.create)
    .setLabel("Create Ticket")
    .setEmoji("🎫")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  return { embeds: [embed], components: [row] };
}

function buildTicketModal(): ModalBuilder {
  const subject = new LabelBuilder()
    .setLabel("Subject")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(FIELD_IDS.subject)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("A short summary of your issue")
        .setMaxLength(100)
        .setRequired(true)
    );

  const description = new LabelBuilder()
    .setLabel("Description")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(FIELD_IDS.description)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Tell us what's going on, with as much detail as you can")
        .setMaxLength(2000)
        .setRequired(true)
    );

  const category = new LabelBuilder()
    .setLabel("Category")
    .setStringSelectMenuComponent(
      new StringSelectMenuBuilder()
        .setCustomId(FIELD_IDS.category)
        .setPlaceholder("Pick a category")
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true)
        .addOptions(CATEGORY_CHOICES.map((c) => ({ label: c.label, value: c.value, description: c.description, emoji: c.emoji })))
    );

  return new ModalBuilder()
    .setCustomId(TICKET_IDS.submit)
    .setTitle("Create a ticket")
    .addLabelComponents(subject, description, category);
}

// Shows whether the opener has a linked StreamWizard account, and who, so staff
// can match the ticket to a StreamWizard user instead of just a Discord handle.
function accountFieldValue(opener: TicketOpenerProfile | null): string {
  if (!opener) return "❌ Not linked";
  return `✅ Linked — **${opener.name}** (${opener.email})`;
}

function buildTicketIntroMessage(ticket: DiscordTicket, settings: DiscordTicketSettings | null, opener: TicketOpenerProfile | null) {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setAuthor({ name: `Ticket #${String(ticket.ticket_number).padStart(4, "0")}` })
    .setTitle(ticket.subject)
    .setDescription(ticket.description)
    .addFields(
      { name: "Category", value: categoryLabel(ticket.category), inline: true },
      { name: "StreamWizard account", value: accountFieldValue(opener), inline: true },
      {
        name: "Claimed by",
        value: ticket.claimed_by_discord_user_id ? `<@${ticket.claimed_by_discord_user_id}>` : "Unclaimed",
        inline: true,
      }
    )
    .setTimestamp(new Date(ticket.created_at));

  // Once claimed, the button becomes a disabled marker showing it's taken.
  const claim = new ButtonBuilder()
    .setCustomId(TICKET_IDS.claim)
    .setEmoji("🙋")
    .setStyle(ButtonStyle.Success)
    .setLabel(ticket.claimed_by_discord_user_id ? "Claimed" : "Claim")
    .setDisabled(Boolean(ticket.claimed_by_discord_user_id));

  const close = new ButtonBuilder().setCustomId(TICKET_IDS.close).setLabel("Close Ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger);

  // Once an issue exists, this becomes a link button instead of an action button.
  const github = ticket.github_issue_url
    ? new ButtonBuilder()
        .setLabel(`Issue #${ticket.github_issue_number}`)
        .setEmoji("🐙")
        .setStyle(ButtonStyle.Link)
        .setURL(ticket.github_issue_url)
    : new ButtonBuilder().setCustomId(TICKET_IDS.github).setLabel("Move to GitHub").setEmoji("🐙").setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claim, close, github);

  const mentions = [`<@${ticket.opener_discord_user_id}>`];
  if (settings?.staff_role_id) mentions.push(`<@&${settings.staff_role_id}>`);

  return { content: mentions.join(" "), embeds: [embed], components: [row] };
}

export async function handleCreateButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!settings?.enabled || !settings.category_id || !settings.staff_role_id) {
    await interaction.reply({ content: "Ticketing isn't set up in this server yet.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.showModal(buildTicketModal());
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!settings?.enabled || !settings.category_id || !settings.staff_role_id) {
    await interaction.reply({ content: "Ticketing isn't set up in this server yet.", flags: MessageFlags.Ephemeral });
    return;
  }

  const subject = interaction.fields.getTextInputValue(FIELD_IDS.subject);
  const description = interaction.fields.getTextInputValue(FIELD_IDS.description);
  const category = interaction.fields.getStringSelectValues(FIELD_IDS.category)[0] as DiscordTicketCategory;

  // Defer ephemerally: channel creation + DB writes can take a moment.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { data: integration } = await getDiscordIntegrationByDiscordUserId(supabase, interaction.user.id);
  const openerUserId = integration?.user_id ?? null;
  const openerProfile = openerUserId ? await getTicketOpenerProfile(supabase, openerUserId) : null;
  const ticketNumber = await nextTicketNumber(supabase, interaction.guildId);

  const channel = await interaction.guild.channels.create({
    name: `ticket-${String(ticketNumber).padStart(4, "0")}`,
    type: ChannelType.GuildText,
    parent: settings.category_id,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: settings.staff_role_id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: interaction.client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ],
  });

  const ticket = await createTicket(supabase, {
    guildId: interaction.guildId,
    ticketNumber,
    channelId: channel.id,
    openerDiscordUserId: interaction.user.id,
    openerUserId,
    subject,
    description,
    category,
  });

  await channel.send(buildTicketIntroMessage(ticket, settings, openerProfile));

  await interaction.editReply({ content: `✅ Your ticket is open: <#${channel.id}>` });
}

export async function handleClaimButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!isStaff(interaction.member, settings)) {
    await interaction.reply({ content: "Only staff can claim tickets.", flags: MessageFlags.Ephemeral });
    return;
  }

  const claimed = await claimTicket(supabase, interaction.channelId, interaction.user.id);

  // Race-safe: claimTicket returns null if it was already claimed (or not a ticket).
  if (!claimed) {
    const current = await getTicketByChannelId(supabase, interaction.channelId);
    const message = current?.claimed_by_discord_user_id
      ? `This ticket is already claimed by <@${current.claimed_by_discord_user_id}>.`
      : "This channel isn't a tracked ticket.";
    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    return;
  }

  const opener = claimed.opener_user_id ? await getTicketOpenerProfile(supabase, claimed.opener_user_id) : null;
  // Edit the intro message in place so the claim state + disabled button update for everyone.
  await interaction.update(buildTicketIntroMessage(claimed, settings, opener));
  await interaction.followUp({ content: `🙋 You claimed this ticket.`, flags: MessageFlags.Ephemeral });
}

export async function handleGithubButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!isStaff(interaction.member, settings)) {
    await interaction.reply({ content: "Only staff can move tickets to GitHub.", flags: MessageFlags.Ephemeral });
    return;
  }

  const ticket = await getTicketByChannelId(supabase, interaction.channelId);
  if (!ticket) {
    await interaction.reply({ content: "This channel isn't a tracked ticket.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (ticket.github_issue_url) {
    await interaction.reply({ content: `This ticket is already on GitHub: ${ticket.github_issue_url}`, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferUpdate();

  const opener = ticket.opener_user_id ? await getTicketOpenerProfile(supabase, ticket.opener_user_id) : null;
  const body = [
    ticket.description,
    "",
    `**Category:** ${categoryLabel(ticket.category)}`,
    `**Discord ticket:** #${String(ticket.ticket_number).padStart(4, "0")}`,
    `**Opened by:** ${opener ? `${opener.name} (${opener.email})` : `Discord user <@${ticket.opener_discord_user_id}>`}`,
  ].join("\n");

  const octokit = getInstallationOctokit({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
    installationId: env.GITHUB_APP_INSTALLATION_ID,
  });
  const issue = await createTicketIssue(octokit, env.GITHUB_ISSUES_REPO, { title: ticket.subject, body });

  await setTicketGithubIssue(supabase, ticket.channel_id, issue.number, issue.url);

  const updated = await getTicketByChannelId(supabase, ticket.channel_id);
  if (updated) {
    await interaction.editReply(buildTicketIntroMessage(updated, settings, opener));
  }
  await interaction.followUp({ content: `🐙 Created GitHub issue #${issue.number}: ${issue.url}`, flags: MessageFlags.Ephemeral });
}

export async function handleCloseButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!isStaff(interaction.member, settings)) {
    await interaction.reply({ content: "Only staff can close tickets.", flags: MessageFlags.Ephemeral });
    return;
  }

  const confirm = new ButtonBuilder().setCustomId(TICKET_IDS.closeConfirm).setLabel("Close it").setStyle(ButtonStyle.Danger);
  const cancel = new ButtonBuilder().setCustomId(TICKET_IDS.closeCancel).setLabel("Cancel").setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, cancel);

  await interaction.reply({
    content: "Close this ticket? The channel will be deleted.",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleCloseCancel(interaction: ButtonInteraction): Promise<void> {
  await interaction.update({ content: "Cancelled — the ticket stays open.", components: [] });
}

// Shared by the close-confirm button and the /ticket close command.
export async function closeTicketChannel(channel: TextChannel, closedBy: GuildMember): Promise<boolean> {
  const ticket = await getTicketByChannelId(supabase, channel.id);
  if (!ticket) return false;

  await closeTicket(supabase, channel.id, closedBy.id);

  const settings = await getTicketSettings(supabase, channel.guild.id);
  if (settings?.log_channel_id) {
    const logChannel = await channel.guild.channels.fetch(settings.log_channel_id).catch(() => null);
    if (logChannel?.type === ChannelType.GuildText) {
      const opener = ticket.opener_user_id ? await getTicketOpenerProfile(supabase, ticket.opener_user_id) : null;
      const embed = new EmbedBuilder()
        .setColor(TWITCH_PURPLE)
        .setTitle(`Ticket #${String(ticket.ticket_number).padStart(4, "0")} closed`)
        .addFields(
          { name: "Subject", value: ticket.subject },
          { name: "Category", value: categoryLabel(ticket.category), inline: true },
          { name: "Opened by", value: `<@${ticket.opener_discord_user_id}>`, inline: true },
          {
            name: "Claimed by",
            value: ticket.claimed_by_discord_user_id ? `<@${ticket.claimed_by_discord_user_id}>` : "Unclaimed",
            inline: true,
          },
          { name: "Closed by", value: `<@${closedBy.id}>`, inline: true },
          { name: "StreamWizard account", value: accountFieldValue(opener) }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  }

  await channel.delete(`Ticket closed by ${closedBy.user.tag}`);
  return true;
}

export async function handleCloseConfirm(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!isStaff(interaction.member, settings)) {
    await interaction.update({ content: "Only staff can close tickets.", components: [] });
    return;
  }

  if (interaction.channel?.type !== ChannelType.GuildText) {
    await interaction.update({ content: "This isn't a ticket channel.", components: [] });
    return;
  }

  await interaction.update({ content: "Closing this ticket…", components: [] });

  const closed = await closeTicketChannel(interaction.channel, interaction.member);
  if (!closed) {
    await interaction.editReply({ content: "This channel isn't a tracked ticket." });
  }
}

// Single entry point used by interactionCreate for all ticket: component interactions.
export async function handleTicketInteraction(
  interaction: ButtonInteraction | ModalSubmitInteraction
): Promise<void> {
  try {
    if (interaction.isModalSubmit()) {
      if (interaction.customId === TICKET_IDS.submit) await handleModalSubmit(interaction);
      return;
    }

    switch (interaction.customId) {
      case TICKET_IDS.create:
        await handleCreateButton(interaction);
        break;
      case TICKET_IDS.claim:
        await handleClaimButton(interaction);
        break;
      case TICKET_IDS.github:
        await handleGithubButton(interaction);
        break;
      case TICKET_IDS.close:
        await handleCloseButton(interaction);
        break;
      case TICKET_IDS.closeConfirm:
        await handleCloseConfirm(interaction);
        break;
      case TICKET_IDS.closeCancel:
        await handleCloseCancel(interaction);
        break;
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[tickets] Error handling "${interaction.customId}":`, error);

    const payload = { content: "Something went wrong with that ticket action.", flags: MessageFlags.Ephemeral } as const;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else if (!interaction.isModalSubmit() || interaction.isFromMessage()) {
      await interaction.reply(payload).catch(() => {});
    }
  }
}
