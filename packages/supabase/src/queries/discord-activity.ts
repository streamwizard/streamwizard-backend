import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export type DiscordActivitySettings = Database["public"]["Tables"]["discord_activity_settings"]["Row"];
export type DiscordDailyActivity = Database["public"]["Tables"]["discord_daily_activity"]["Row"];
export type DiscordVoiceSession = Database["public"]["Tables"]["discord_voice_sessions"]["Row"];

// Metrics exposed to /leaderboard and /rank. "reactions" means reactions added.
export type LeaderboardMetric = "messages" | "voice" | "reactions";

// ---------------------------------------------------------------------------
// Settings & ignored channels
// ---------------------------------------------------------------------------

export async function getActivitySettings(client: DBClient, guildId: string): Promise<DiscordActivitySettings | null> {
  const { data, error } = await client.from("discord_activity_settings").select("*").eq("guild_id", guildId).maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertActivitySettings(
  client: DBClient,
  guildId: string,
  patch: Partial<Omit<DiscordActivitySettings, "id" | "guild_id" | "created_at" | "updated_at">>
): Promise<void> {
  const { error } = await client
    .from("discord_activity_settings")
    .upsert({ guild_id: guildId, ...patch }, { onConflict: "guild_id" });

  if (error) throw error;
}

export async function getIgnoredChannelIds(client: DBClient, guildId: string): Promise<string[]> {
  const { data, error } = await client.from("discord_activity_ignored_channels").select("channel_id").eq("guild_id", guildId);

  if (error) throw error;
  return (data ?? []).map((row) => row.channel_id);
}

export async function addIgnoredChannel(client: DBClient, guildId: string, channelId: string): Promise<void> {
  const { error } = await client
    .from("discord_activity_ignored_channels")
    .upsert({ guild_id: guildId, channel_id: channelId }, { onConflict: "guild_id,channel_id" });

  if (error) throw error;
}

export async function removeIgnoredChannel(client: DBClient, guildId: string, channelId: string): Promise<void> {
  const { error } = await client
    .from("discord_activity_ignored_channels")
    .delete()
    .eq("guild_id", guildId)
    .eq("channel_id", channelId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type ActivityIncrement = {
  guildId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  messages?: number;
  reactionsAdded?: number;
  reactionsReceived?: number;
  voiceSeconds?: number;
};

// Atomically upserts and increments a member's daily counters.
export async function incrementDailyActivity(client: DBClient, inc: ActivityIncrement): Promise<void> {
  const { error } = await client.rpc("increment_daily_activity", {
    p_guild_id: inc.guildId,
    p_user_id: inc.userId,
    p_date: inc.date,
    p_messages: inc.messages ?? 0,
    p_reactions_added: inc.reactionsAdded ?? 0,
    p_reactions_received: inc.reactionsReceived ?? 0,
    p_voice_seconds: inc.voiceSeconds ?? 0,
  });

  if (error) throw error;
}

// Opens a voice session row and returns its id, used to close it later.
export async function openVoiceSession(
  client: DBClient,
  params: { guildId: string; userId: string; channelId: string; joinedAt: Date }
): Promise<string> {
  const { data, error } = await client
    .from("discord_voice_sessions")
    .insert({
      guild_id: params.guildId,
      user_id: params.userId,
      channel_id: params.channelId,
      joined_at: params.joinedAt.toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function closeVoiceSession(
  client: DBClient,
  sessionId: string,
  leftAt: Date,
  durationSeconds: number
): Promise<void> {
  const { error } = await client
    .from("discord_voice_sessions")
    .update({ left_at: leftAt.toISOString(), duration_seconds: durationSeconds })
    .eq("id", sessionId);

  if (error) throw error;
}

// Returns voice sessions left open (e.g. by a crash) so startup can reconcile them.
export async function getOpenVoiceSessions(client: DBClient, guildId: string): Promise<DiscordVoiceSession[]> {
  const { data, error } = await client
    .from("discord_voice_sessions")
    .select("*")
    .eq("guild_id", guildId)
    .is("left_at", null);

  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Reads (aggregations) — plain queries, summed in JS. PostgREST caps a single
// response at 1000 rows, so we page through results for wide date ranges
// (e.g. "all time" on a long-running, active guild).
// ---------------------------------------------------------------------------

const PAGE_SIZE = 1000;

type DailyMetricRow = Pick<DiscordDailyActivity, "user_id" | "messages_sent" | "reactions_added" | "reactions_received" | "voice_seconds">;

async function fetchDailyMetricRows(
  client: DBClient,
  guildId: string,
  from: string,
  to: string,
  userId?: string
): Promise<DailyMetricRow[]> {
  const rows: DailyMetricRow[] = [];
  let offset = 0;

  while (true) {
    let query = client
      .from("discord_daily_activity")
      .select("user_id, messages_sent, reactions_added, reactions_received, voice_seconds")
      .eq("guild_id", guildId)
      .gte("activity_date", from)
      .lte("activity_date", to)
      .range(offset, offset + PAGE_SIZE - 1);
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

function metricValue(metric: LeaderboardMetric, row: DailyMetricRow): number {
  switch (metric) {
    case "voice":
      return row.voice_seconds;
    case "reactions":
      return row.reactions_added;
    default:
      return row.messages_sent;
  }
}

// Sums a metric per user across the given rows.
function totalsByUser(metric: LeaderboardMetric, rows: DailyMetricRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + metricValue(metric, row));
  }
  return totals;
}

export type ActivityTotals = {
  messages_sent: number;
  reactions_added: number;
  reactions_received: number;
  voice_seconds: number;
};

export async function getUserTotals(
  client: DBClient,
  guildId: string,
  userId: string,
  from: string,
  to: string
): Promise<ActivityTotals> {
  const rows = await fetchDailyMetricRows(client, guildId, from, to, userId);
  return rows.reduce<ActivityTotals>(
    (acc, row) => ({
      messages_sent: acc.messages_sent + row.messages_sent,
      reactions_added: acc.reactions_added + row.reactions_added,
      reactions_received: acc.reactions_received + row.reactions_received,
      voice_seconds: acc.voice_seconds + row.voice_seconds,
    }),
    { messages_sent: 0, reactions_added: 0, reactions_received: 0, voice_seconds: 0 }
  );
}

export type ServerTotals = ActivityTotals & { active_members: number };

export async function getServerTotals(client: DBClient, guildId: string, from: string, to: string): Promise<ServerTotals> {
  const rows = await fetchDailyMetricRows(client, guildId, from, to);
  const totals = rows.reduce<ActivityTotals>(
    (acc, row) => ({
      messages_sent: acc.messages_sent + row.messages_sent,
      reactions_added: acc.reactions_added + row.reactions_added,
      reactions_received: acc.reactions_received + row.reactions_received,
      voice_seconds: acc.voice_seconds + row.voice_seconds,
    }),
    { messages_sent: 0, reactions_added: 0, reactions_received: 0, voice_seconds: 0 }
  );
  return { ...totals, active_members: new Set(rows.map((row) => row.user_id)).size };
}

export type LeaderboardEntry = { user_id: string; total: number };

export async function getLeaderboard(
  client: DBClient,
  guildId: string,
  metric: LeaderboardMetric,
  from: string,
  to: string,
  limit = 10
): Promise<LeaderboardEntry[]> {
  const rows = await fetchDailyMetricRows(client, guildId, from, to);
  const totals = totalsByUser(metric, rows);

  return [...totals.entries()]
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([user_id, total]) => ({ user_id, total }));
}

export type UserRank = { rank: number; total: number; ranked_members: number };

export async function getUserRank(
  client: DBClient,
  guildId: string,
  userId: string,
  metric: LeaderboardMetric,
  from: string,
  to: string
): Promise<UserRank> {
  const rows = await fetchDailyMetricRows(client, guildId, from, to);
  const totals = totalsByUser(metric, rows);
  const ranked = [...totals.entries()].filter(([, total]) => total > 0);

  const myTotal = totals.get(userId) ?? 0;
  if (myTotal <= 0) {
    return { rank: 0, total: 0, ranked_members: ranked.length };
  }

  const higherCount = ranked.filter(([, total]) => total > myTotal).length;
  return { rank: higherCount + 1, total: myTotal, ranked_members: ranked.length };
}

// Raw daily rows for a member over a range — used by /recap to build a monthly
// breakdown (max ~366 rows/year, so fetching and bucketing in JS is fine).
export async function getUserDailyRows(
  client: DBClient,
  guildId: string,
  userId: string,
  from: string,
  to: string
): Promise<DiscordDailyActivity[]> {
  const { data, error } = await client
    .from("discord_daily_activity")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .gte("activity_date", from)
    .lte("activity_date", to)
    .order("activity_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
