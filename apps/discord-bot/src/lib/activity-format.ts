import type { LeaderboardMetric } from "@repo/supabase/queries/discord-activity";

export type Timeframe = "7d" | "30d" | "year" | "all";

export const TIMEFRAME_CHOICES: { name: string; value: Timeframe }[] = [
  { name: "Last 7 days", value: "7d" },
  { name: "Last 30 days", value: "30d" },
  { name: "This year", value: "year" },
  { name: "All time", value: "all" },
];

export const METRIC_CHOICES: { name: string; value: LeaderboardMetric }[] = [
  { name: "Messages", value: "messages" },
  { name: "Voice time", value: "voice" },
  { name: "Reactions given", value: "reactions" },
];

export const METRIC_LABEL: Record<LeaderboardMetric, string> = {
  messages: "messages",
  voice: "voice time",
  reactions: "reactions given",
};

function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Resolves a timeframe to an inclusive [from, to] date range (UTC) plus a label.
export function resolveTimeframe(tf: Timeframe): { from: string; to: string; label: string } {
  const today = new Date();
  const to = utcDate(today);

  switch (tf) {
    case "7d": {
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - 6);
      return { from: utcDate(from), to, label: "the last 7 days" };
    }
    case "30d": {
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - 29);
      return { from: utcDate(from), to, label: "the last 30 days" };
    }
    case "year": {
      const year = today.getUTCFullYear();
      return { from: `${year}-01-01`, to, label: `${year}` };
    }
    case "all":
    default:
      return { from: "1970-01-01", to, label: "all time" };
  }
}

export function yearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

// e.g. 4530 -> "1h 15m", 90 -> "1m 30s", 0 -> "0m"
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// Formats a leaderboard/rank total for display, depending on the metric.
export function formatMetricValue(metric: LeaderboardMetric, value: number): string {
  return metric === "voice" ? formatDuration(value) : formatNumber(value);
}

export const MEDALS = ["🥇", "🥈", "🥉"];
