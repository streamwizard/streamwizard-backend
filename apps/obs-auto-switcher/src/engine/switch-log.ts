import type { AutoSwitcherSwitchEntry } from "@repo/schemas";

// In-memory ring of recent switches per user (xpudu recordSwitch pattern).
// Always written, independent of the stream_events toggle — stream_events
// inserts are skipped when the user isn't live on Twitch, this never is.
const MAX_ENTRIES = 100;

const logs = new Map<string, AutoSwitcherSwitchEntry[]>();

export function recordSwitch(userId: string, entry: AutoSwitcherSwitchEntry): void {
  const log = logs.get(userId) ?? [];
  log.push(entry);
  if (log.length > MAX_ENTRIES) log.shift();
  logs.set(userId, log);
}

export function getSwitchLog(userId: string): readonly AutoSwitcherSwitchEntry[] {
  return logs.get(userId) ?? [];
}

export function clearSwitchLog(userId: string): void {
  logs.delete(userId);
}
