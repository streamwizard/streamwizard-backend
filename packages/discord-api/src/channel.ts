import type { DiscordMessagePayload } from "./dm";

const DISCORD_API_BASE = "https://discord.com/api/v10";

export class DiscordRateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Discord rate limited, retry after ${retryAfterSeconds}s`);
    this.name = "DiscordRateLimitError";
  }
}

/**
 * Posts a message to a Discord channel via the bot's REST API — no gateway
 * connection needed, just the bot token. Throws on failure (missing channel,
 * missing Send Messages permission, …); callers that want this to be
 * best-effort should catch it. A 429 throws DiscordRateLimitError so callers
 * can honor retry_after.
 */
export async function sendDiscordChannelMessage(
  channelId: string,
  payload: DiscordMessagePayload,
): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");

  const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
    throw new DiscordRateLimitError(body.retry_after ?? 1);
  }
  if (!res.ok) {
    throw new Error(`Couldn't send message to channel ${channelId}: ${res.status} ${await res.text()}`);
  }
}
