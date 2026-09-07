import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  RoleSelectMenuBuilder,
} from "discord.js";
import type {
  AnySelectMenuInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Guild,
} from "discord.js";
import { supabase } from "@repo/supabase";
import { getGuildSettings, setVerifiedRoleId, setWelcomeChannel, setWelcomeEnabled } from "@repo/supabase/queries/discord";
import {
  addIgnoredChannel,
  getActivitySettings,
  getIgnoredChannelIds,
  removeIgnoredChannel,
  upsertActivitySettings,
} from "@repo/supabase/queries/discord-activity";
import { getTicketSettings, upsertTicketSettings } from "@repo/supabase/queries/tickets";
import { buildPanelMessage } from "./tickets";
import { invalidateSettingsCache } from "./activity-tracker";
import { Sentry } from "../sentry";
import { TWITCH_PURPLE } from "./branding";

// customId namespace for the /setup wizard's components. interactionCreate
// routes anything starting with "setup:" here. Each step writes straight to
// the DB and re-renders the next step, so there's no in-memory wizard state
// to lose across bot restarts.
export const SETUP_IDS = {
  welcomeChannel: "setup:welcome-channel",
  welcomeChannelSkip: "setup:welcome-channel-skip",
  welcomeEnable: "setup:welcome-enable",
  welcomeDisable: "setup:welcome-disable",
  verifiedRole: "setup:verified-role",
  verifiedRoleSkip: "setup:verified-role-skip",
  activityEnable: "setup:activity-enable",
  activityDisable: "setup:activity-disable",
  activityIgnoredChannels: "setup:activity-ignored-channels",
  activityIgnoredSkip: "setup:activity-ignored-skip",
  ticketsYes: "setup:tickets-yes",
  ticketsNo: "setup:tickets-no",
  ticketStaffRole: "setup:ticket-staff-role",
  ticketCategory: "setup:ticket-category",
  ticketPanelChannel: "setup:ticket-panel-channel",
  ticketLogChannel: "setup:ticket-log-channel",
  ticketLogChannelSkip: "setup:ticket-log-channel-skip",
} as const;


function stepWelcomeChannel() {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("StreamWizard Setup — Welcome Channel")
    .setDescription("Which channel should new-member welcome messages be posted in?\n\nPick a channel below, or skip to leave it on the server's default system channel.");

  const select = new ChannelSelectMenuBuilder()
    .setCustomId(SETUP_IDS.welcomeChannel)
    .setPlaceholder("Select a welcome channel")
    .addChannelTypes(ChannelType.GuildText);

  const skip = new ButtonBuilder().setCustomId(SETUP_IDS.welcomeChannelSkip).setLabel("Skip").setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select),
      new ActionRowBuilder<ButtonBuilder>().addComponents(skip),
    ],
  };
}

function stepWelcomeToggle() {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("StreamWizard Setup — Welcome Messages")
    .setDescription("Should welcome messages be posted at all?");

  const enable = new ButtonBuilder().setCustomId(SETUP_IDS.welcomeEnable).setLabel("Enable").setStyle(ButtonStyle.Success);
  const disable = new ButtonBuilder().setCustomId(SETUP_IDS.welcomeDisable).setLabel("Disable").setStyle(ButtonStyle.Danger);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(enable, disable)],
  };
}

function stepVerifiedRole() {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("StreamWizard Setup — Verified Role")
    .setDescription("Which role should members get when they link their StreamWizard account?\n\nPick a role below, or skip to leave verification role-granting off.");

  const select = new RoleSelectMenuBuilder().setCustomId(SETUP_IDS.verifiedRole).setPlaceholder("Select a verified role");

  const skip = new ButtonBuilder().setCustomId(SETUP_IDS.verifiedRoleSkip).setLabel("Skip").setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(select),
      new ActionRowBuilder<ButtonBuilder>().addComponents(skip),
    ],
  };
}

function stepActivityPrompt() {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("StreamWizard Setup — Activity Tracking")
    .setDescription(
      "Track how active your members are — messages, reactions, and voice time — so they can check `/rank`, `/leaderboard`, and an end-of-year `/recap`.\n\n" +
        "We only count activity. We never store message text. Voice time doesn't count while someone is muted, deafened, or alone in a channel."
    );

  const enable = new ButtonBuilder().setCustomId(SETUP_IDS.activityEnable).setLabel("Track activity").setStyle(ButtonStyle.Success);
  const disable = new ButtonBuilder().setCustomId(SETUP_IDS.activityDisable).setLabel("Don't track").setStyle(ButtonStyle.Danger);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(enable, disable)],
  };
}

function stepActivityIgnoredChannels(currentChannelIds: string[]) {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("StreamWizard Setup — Untracked Channels")
    .setDescription(
      "Pick any channels to leave out of activity tracking — think `#bot-spam` or `#commands`. Messages and reactions there won't count.\n\nLeave it empty to track everything, then continue."
    );

  const select = new ChannelSelectMenuBuilder()
    .setCustomId(SETUP_IDS.activityIgnoredChannels)
    .setPlaceholder("Select channels to ignore")
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
    .setMinValues(0)
    .setMaxValues(25);

  if (currentChannelIds.length > 0) {
    select.setDefaultChannels(...currentChannelIds);
  }

  const skip = new ButtonBuilder().setCustomId(SETUP_IDS.activityIgnoredSkip).setLabel("Continue").setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select),
      new ActionRowBuilder<ButtonBuilder>().addComponents(skip),
    ],
  };
}

function stepTicketsPrompt() {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("StreamWizard Setup — Support Tickets")
    .setDescription("Want to set up the support ticket system? This posts a \"Create Ticket\" panel and lets members open private support channels.");

  const yes = new ButtonBuilder().setCustomId(SETUP_IDS.ticketsYes).setLabel("Yes, set it up").setStyle(ButtonStyle.Success);
  const no = new ButtonBuilder().setCustomId(SETUP_IDS.ticketsNo).setLabel("No, skip").setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(yes, no)],
  };
}

function stepTicketStaffRole() {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("StreamWizard Setup — Ticket Staff Role")
    .setDescription("Which role can see and manage support tickets?");

  const select = new RoleSelectMenuBuilder().setCustomId(SETUP_IDS.ticketStaffRole).setPlaceholder("Select a staff role");

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(select)],
  };
}

function stepTicketCategory() {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("StreamWizard Setup — Ticket Category")
    .setDescription("Which category should new ticket channels be created under?");

  const select = new ChannelSelectMenuBuilder()
    .setCustomId(SETUP_IDS.ticketCategory)
    .setPlaceholder("Select a category")
    .addChannelTypes(ChannelType.GuildCategory);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select)],
  };
}

function stepTicketPanelChannel() {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("StreamWizard Setup — Ticket Panel Channel")
    .setDescription("Which channel should the \"Create Ticket\" panel be posted in?");

  const select = new ChannelSelectMenuBuilder()
    .setCustomId(SETUP_IDS.ticketPanelChannel)
    .setPlaceholder("Select a channel")
    .addChannelTypes(ChannelType.GuildText);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select)],
  };
}

function stepTicketLogChannel() {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("StreamWizard Setup — Ticket Log Channel")
    .setDescription("Optional: pick a channel to log closed tickets in, or skip.");

  const select = new ChannelSelectMenuBuilder()
    .setCustomId(SETUP_IDS.ticketLogChannel)
    .setPlaceholder("Select a log channel")
    .addChannelTypes(ChannelType.GuildText);

  const skip = new ButtonBuilder().setCustomId(SETUP_IDS.ticketLogChannelSkip).setLabel("Skip").setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select),
      new ActionRowBuilder<ButtonBuilder>().addComponents(skip),
    ],
  };
}

// Swaps the verified role on everyone who already holds the old one. Without
// this, changing the verified role in /setup only affects future grants —
// members verified under the previous role would keep it forever.
async function migrateVerifiedRole(guild: Guild, oldRoleId: string, newRoleId: string) {
  try {
    const members = await guild.members.fetch();
    const holders = members.filter((member) => member.roles.cache.has(oldRoleId));

    for (const member of holders.values()) {
      try {
        await member.roles.remove(oldRoleId);
        await member.roles.add(newRoleId);
      } catch (error) {
        Sentry.captureException(error);
        console.error(`[setup] Failed to migrate verified role for "${member.user.tag}" in "${guild.name}":`, error);
      }
    }

    console.log(`[setup] Migrated verified role for ${holders.size} member(s) in "${guild.name}"`);
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[setup] Failed to fetch members for verified role migration in "${guild.name}":`, error);
  }
}

async function summary(guildId: string) {
  const [settings, ticketSettings, activitySettings, ignoredChannels] = await Promise.all([
    getGuildSettings(supabase, guildId),
    getTicketSettings(supabase, guildId),
    getActivitySettings(supabase, guildId),
    getIgnoredChannelIds(supabase, guildId),
  ]);

  const channelLine = settings?.welcome_channel_id
    ? `<#${settings.welcome_channel_id}>`
    : "not set (falls back to the server's system channel)";
  const enabledLine = settings?.welcome_enabled === false ? "Disabled" : "Enabled";
  const roleLine = settings?.verified_role_id ? `<@&${settings.verified_role_id}>` : "not set";

  const ticketLines = ticketSettings
    ? [
        `**Status:** ${ticketSettings.enabled ? "enabled" : "disabled"}`,
        `**Staff role:** ${ticketSettings.staff_role_id ? `<@&${ticketSettings.staff_role_id}>` : "not set"}`,
        `**Category:** ${ticketSettings.category_id ? `<#${ticketSettings.category_id}>` : "not set"}`,
        `**Panel channel:** ${ticketSettings.panel_channel_id ? `<#${ticketSettings.panel_channel_id}>` : "not set"}`,
        `**Log channel:** ${ticketSettings.log_channel_id ? `<#${ticketSettings.log_channel_id}>` : "not set"}`,
      ].join("\n")
    : "Not set up — run `/setup` again to configure.";

  // No settings row means tracking is on by default.
  const activityStatus = activitySettings?.tracking_enabled === false ? "Disabled" : "Enabled";
  const ignoredLine =
    ignoredChannels.length > 0 ? ignoredChannels.map((id) => `<#${id}>`).join(", ") : "none";
  const activityLines = `**Status:** ${activityStatus}\n**Untracked channels:** ${ignoredLine}`;

  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("✅ StreamWizard Setup Complete")
    .setDescription(
      `**Welcome message**\nChannel: ${channelLine}\nStatus: ${enabledLine}\n\n` +
        `**Verification**\nRole: ${roleLine}\n\n` +
        `**Activity tracking**\n${activityLines}\n\n` +
        `**Support tickets**\n${ticketLines}\n\n` +
        "Run `/setup` again any time to change these."
    );

  return { embeds: [embed], components: [] };
}

export async function startSetupWizard(interaction: ChatInputCommandInteraction) {
  await interaction.reply({ ...stepWelcomeChannel(), flags: MessageFlags.Ephemeral });
}

export async function handleSetupInteraction(interaction: ButtonInteraction | AnySelectMenuInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.update({ content: "This can only be used in a server.", embeds: [], components: [] });
    return;
  }

  const guildId = interaction.guildId;

  switch (interaction.customId) {
    case SETUP_IDS.welcomeChannel: {
      const channelId = interaction.isChannelSelectMenu() ? interaction.values[0] : undefined;
      if (channelId) {
        await setWelcomeChannel(supabase, guildId, channelId);
      }
      await interaction.update(stepWelcomeToggle());
      return;
    }
    case SETUP_IDS.welcomeChannelSkip: {
      await interaction.update(stepWelcomeToggle());
      return;
    }
    case SETUP_IDS.welcomeEnable: {
      await setWelcomeEnabled(supabase, guildId, true);
      await interaction.update(stepVerifiedRole());
      return;
    }
    case SETUP_IDS.welcomeDisable: {
      await setWelcomeEnabled(supabase, guildId, false);
      await interaction.update(stepVerifiedRole());
      return;
    }
    case SETUP_IDS.verifiedRole: {
      const roleId = interaction.isRoleSelectMenu() ? interaction.values[0] : undefined;
      if (roleId) {
        const previousSettings = await getGuildSettings(supabase, guildId);
        const oldRoleId = previousSettings?.verified_role_id;

        await setVerifiedRoleId(supabase, guildId, roleId);

        if (oldRoleId && oldRoleId !== roleId) {
          await migrateVerifiedRole(interaction.guild, oldRoleId, roleId);
        }
      }
      await interaction.update(stepActivityPrompt());
      return;
    }
    case SETUP_IDS.verifiedRoleSkip: {
      await interaction.update(stepActivityPrompt());
      return;
    }
    case SETUP_IDS.activityEnable: {
      await upsertActivitySettings(supabase, guildId, { tracking_enabled: true });
      invalidateSettingsCache(guildId);
      const currentIgnored = await getIgnoredChannelIds(supabase, guildId);
      await interaction.update(stepActivityIgnoredChannels(currentIgnored));
      return;
    }
    case SETUP_IDS.activityDisable: {
      await upsertActivitySettings(supabase, guildId, { tracking_enabled: false });
      invalidateSettingsCache(guildId);
      await interaction.update(stepTicketsPrompt());
      return;
    }
    case SETUP_IDS.activityIgnoredChannels: {
      const selected = interaction.isChannelSelectMenu() ? interaction.values : [];
      const current = await getIgnoredChannelIds(supabase, guildId);
      const toAdd = selected.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !selected.includes(id));
      await Promise.all([
        ...toAdd.map((id) => addIgnoredChannel(supabase, guildId, id)),
        ...toRemove.map((id) => removeIgnoredChannel(supabase, guildId, id)),
      ]);
      invalidateSettingsCache(guildId);
      await interaction.update(stepTicketsPrompt());
      return;
    }
    case SETUP_IDS.activityIgnoredSkip: {
      await interaction.update(stepTicketsPrompt());
      return;
    }
    case SETUP_IDS.ticketsYes: {
      await upsertTicketSettings(supabase, guildId, { enabled: true });
      await interaction.update(stepTicketStaffRole());
      return;
    }
    case SETUP_IDS.ticketsNo: {
      await interaction.update(await summary(guildId));
      return;
    }
    case SETUP_IDS.ticketStaffRole: {
      const roleId = interaction.isRoleSelectMenu() ? interaction.values[0] : undefined;
      if (roleId) {
        await upsertTicketSettings(supabase, guildId, { staff_role_id: roleId });
      }
      await interaction.update(stepTicketCategory());
      return;
    }
    case SETUP_IDS.ticketCategory: {
      const categoryId = interaction.isChannelSelectMenu() ? interaction.values[0] : undefined;
      if (categoryId) {
        await upsertTicketSettings(supabase, guildId, { category_id: categoryId });
      }
      await interaction.update(stepTicketPanelChannel());
      return;
    }
    case SETUP_IDS.ticketPanelChannel: {
      const channelId = interaction.isChannelSelectMenu() ? interaction.values[0] : undefined;
      if (channelId) {
        const channel = await interaction.guild.channels.fetch(channelId);
        if (channel?.isTextBased()) {
          const panelMessage = await channel.send(buildPanelMessage());
          await upsertTicketSettings(supabase, guildId, {
            panel_channel_id: channelId,
            panel_message_id: panelMessage.id,
          });
        }
      }
      await interaction.update(stepTicketLogChannel());
      return;
    }
    case SETUP_IDS.ticketLogChannel: {
      const channelId = interaction.isChannelSelectMenu() ? interaction.values[0] : undefined;
      if (channelId) {
        await upsertTicketSettings(supabase, guildId, { log_channel_id: channelId });
      }
      await interaction.update(await summary(guildId));
      return;
    }
    case SETUP_IDS.ticketLogChannelSkip: {
      await interaction.update(await summary(guildId));
      return;
    }
  }
}
