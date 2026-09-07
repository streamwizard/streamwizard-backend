import type {
  Client,
  Guild,
  GuildMember,
  Message,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
  VoiceBasedChannel,
  VoiceState,
} from "discord.js";
import { supabase } from "@repo/supabase";
import {
  closeVoiceSession,
  getActivitySettings,
  getIgnoredChannelIds,
  getOpenVoiceSessions,
  incrementDailyActivity,
  openVoiceSession,
  type DiscordActivitySettings,
} from "@repo/supabase/queries/discord-activity";
import { Sentry } from "../sentry";

// How long a guild's settings + ignored-channel list stays cached before we
// re-read it. Messages are high-frequency, so we must not hit the DB per event.
const SETTINGS_TTL_MS = 60_000;

type TrackingContext = {
  settings: DiscordActivitySettings;
  ignoredChannelIds: Set<string>;
  fetchedAt: number;
};

// Defaults used when a guild has no settings row yet (tracking on).
function defaultSettings(guildId: string): DiscordActivitySettings {
  const now = new Date().toISOString();
  return {
    id: "",
    guild_id: guildId,
    tracking_enabled: true,
    track_messages: true,
    track_reactions: true,
    track_voice: true,
    voice_ignore_afk: true,
    voice_require_others: true,
    created_at: now,
    updated_at: now,
  };
}

const settingsCache = new Map<string, TrackingContext>();

// Open voice sessions in memory, keyed by `${guildId}:${userId}`.
type OpenSession = { sessionId: string; channelId: string; startedAt: Date };
const openSessions = new Map<string, OpenSession>();

// ---------------------------------------------------------------------------
// Settings cache
// ---------------------------------------------------------------------------

async function getContext(guildId: string): Promise<TrackingContext> {
  const cached = settingsCache.get(guildId);
  if (cached && Date.now() - cached.fetchedAt < SETTINGS_TTL_MS) return cached;

  const [settings, ignored] = await Promise.all([getActivitySettings(supabase, guildId), getIgnoredChannelIds(supabase, guildId)]);
  const ctx: TrackingContext = {
    settings: settings ?? defaultSettings(guildId),
    ignoredChannelIds: new Set(ignored),
    fetchedAt: Date.now(),
  };
  settingsCache.set(guildId, ctx);
  return ctx;
}

// Call after staff change a guild's tracking config so the next event re-reads it.
export function invalidateSettingsCache(guildId: string): void {
  settingsCache.delete(guildId);
}

// ---------------------------------------------------------------------------
// Writes — straight through to the DB, no batching. If write volume becomes a
// problem (busy servers, many guilds), reintroduce a buffer here — e.g. backed
// by Redis instead of an in-memory Map, so counts survive a restart.
// ---------------------------------------------------------------------------

function utcDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

async function recordIncrement(
  guildId: string,
  userId: string,
  date: string,
  deltas: { messages?: number; reactionsAdded?: number; reactionsReceived?: number; voiceSeconds?: number }
): Promise<void> {
  try {
    await incrementDailyActivity(supabase, { guildId, userId, date, ...deltas });
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[activity] Failed to record counts for ${guildId}/${userId}:`, error);
  }
}

// ---------------------------------------------------------------------------
// Message + reaction tracking
// ---------------------------------------------------------------------------

function isChannelIgnored(ctx: TrackingContext, channelId: string | null, parentId: string | null): boolean {
  if (channelId && ctx.ignoredChannelIds.has(channelId)) return true;
  if (parentId && ctx.ignoredChannelIds.has(parentId)) return true;
  return false;
}

export async function recordMessage(message: Message): Promise<void> {
  if (!message.guildId || message.author?.bot) return;
  try {
    const ctx = await getContext(message.guildId);
    if (!ctx.settings.tracking_enabled || !ctx.settings.track_messages) return;
    if (isChannelIgnored(ctx, message.channelId, "parentId" in message.channel ? message.channel.parentId : null)) return;
    await recordIncrement(message.guildId, message.author.id, utcDate(), { messages: 1 });
  } catch (error) {
    Sentry.captureException(error);
  }
}

export async function recordReaction(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
  if (user.bot) return;
  const guildId = reaction.message.guildId;
  if (!guildId) return;
  try {
    const ctx = await getContext(guildId);
    if (!ctx.settings.tracking_enabled || !ctx.settings.track_reactions) return;

    const channel = reaction.message.channel;
    const parentId = channel && "parentId" in channel ? channel.parentId : null;
    if (isChannelIgnored(ctx, reaction.message.channelId, parentId)) return;

    const date = utcDate();
    const writes: Promise<void>[] = [recordIncrement(guildId, user.id, date, { reactionsAdded: 1 })];

    // Credit the message author with a received reaction. The message may be a
    // partial (uncached) — fetch it to learn the author.
    let author = reaction.message.author;
    if (!author) {
      try {
        author = (await reaction.message.fetch()).author;
      } catch {
        author = null;
      }
    }
    if (author && !author.bot && author.id !== user.id) {
      writes.push(recordIncrement(guildId, author.id, date, { reactionsReceived: 1 }));
    }

    await Promise.all(writes);
  } catch (error) {
    Sentry.captureException(error);
  }
}

// ---------------------------------------------------------------------------
// Voice tracking
// ---------------------------------------------------------------------------

function humanCount(channel: VoiceBasedChannel): number {
  return channel.members.filter((m) => !m.user.bot).size;
}

function isVoiceEligible(member: GuildMember, settings: DiscordActivitySettings): boolean {
  const voice = member.voice;
  const channel = voice.channel;
  if (!channel) return false;
  if (settings.voice_ignore_afk && (voice.selfMute || voice.selfDeaf || voice.serverMute || voice.serverDeaf)) return false;
  if (settings.voice_require_others && humanCount(channel) < 2) return false;
  return true;
}

async function openSession(guildId: string, member: GuildMember, channelId: string): Promise<void> {
  const startedAt = new Date();
  try {
    const sessionId = await openVoiceSession(supabase, { guildId, userId: member.id, channelId, joinedAt: startedAt });
    openSessions.set(`${guildId}:${member.id}`, { sessionId, channelId, startedAt });
  } catch (error) {
    Sentry.captureException(error);
  }
}

async function closeSession(guildId: string, userId: string): Promise<void> {
  const key = `${guildId}:${userId}`;
  const open = openSessions.get(key);
  if (!open) return;
  openSessions.delete(key);

  const leftAt = new Date();
  const durationSeconds = Math.max(0, Math.floor((leftAt.getTime() - open.startedAt.getTime()) / 1000));
  try {
    await closeVoiceSession(supabase, open.sessionId, leftAt, durationSeconds);
    if (durationSeconds > 0) {
      await recordIncrement(guildId, userId, utcDate(open.startedAt), { voiceSeconds: durationSeconds });
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}

// Reconciles one member's open/closed state against their current eligibility.
async function reevaluateMember(member: GuildMember, settings: DiscordActivitySettings): Promise<void> {
  if (member.user.bot) return;
  const guildId = member.guild.id;
  const key = `${guildId}:${member.id}`;
  const open = openSessions.get(key);
  const eligible = isVoiceEligible(member, settings);
  const channelId = member.voice.channelId;

  if (eligible && channelId) {
    if (!open) {
      await openSession(guildId, member, channelId);
    } else if (open.channelId !== channelId) {
      await closeSession(guildId, member.id);
      await openSession(guildId, member, channelId);
    }
  } else if (open) {
    await closeSession(guildId, member.id);
  }
}

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const guild = newState.guild ?? oldState.guild;
  const mover = newState.member ?? oldState.member;
  if (!guild || !mover) return;

  try {
    const ctx = await getContext(guild.id);
    if (!ctx.settings.tracking_enabled || !ctx.settings.track_voice) {
      // Tracking turned off mid-session — close anything still open for the mover.
      await closeSession(guild.id, mover.id);
      return;
    }

    // "Alone" eligibility depends on everyone in the affected channels, and a
    // join/leave only fires for the mover — so re-evaluate every human in both
    // the old and new channel, plus the mover (who may have left voice).
    const channels = new Set<VoiceBasedChannel>();
    if (oldState.channel) channels.add(oldState.channel);
    if (newState.channel) channels.add(newState.channel);

    const seen = new Set<string>();
    for (const channel of channels) {
      for (const member of channel.members.values()) {
        seen.add(member.id);
        await reevaluateMember(member, ctx.settings);
      }
    }
    if (!seen.has(mover.id)) {
      await reevaluateMember(mover, ctx.settings);
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}

// On startup, orphaned open sessions (from a crash/restart) can't be credited
// accurately, so close them with zero duration, then open fresh sessions for
// everyone currently sitting in voice.
export async function reconcileVoiceSessions(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    try {
      const orphans = await getOpenVoiceSessions(supabase, guild.id);
      const now = new Date();
      await Promise.all(orphans.map((s) => closeVoiceSession(supabase, s.id, now, 0).catch((e) => Sentry.captureException(e))));

      const ctx = await getContext(guild.id);
      if (!ctx.settings.tracking_enabled || !ctx.settings.track_voice) continue;

      for (const channel of guild.channels.cache.values()) {
        if (!channel.isVoiceBased()) continue;
        for (const member of channel.members.values()) {
          await reevaluateMember(member, ctx.settings);
        }
      }
    } catch (error) {
      Sentry.captureException(error);
      console.error(`[activity] Failed to reconcile voice sessions for "${guild.name}":`, error);
    }
  }
}

// Closes every open voice session (crediting their elapsed time) — called on
// graceful shutdown so an in-progress call isn't lost.
export async function shutdownTracker(): Promise<void> {
  const open = [...openSessions.keys()];
  await Promise.all(
    open.map((key) => {
      const [guildId, userId] = key.split(":");
      return guildId && userId ? closeSession(guildId, userId) : Promise.resolve();
    })
  );
}
