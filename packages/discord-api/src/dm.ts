const DISCORD_API_BASE = "https://discord.com/api/v10";

// Minimal shapes for the Discord message-create REST schema — just enough to
// build embeds and link buttons without pulling in discord.js (this package
// is REST-only, no gateway connection).
export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  /** ISO 8601 — Discord renders it localized under the embed. */
  timestamp?: string;
}

export interface DiscordLinkButton {
  type: 2; // Button
  style: 5; // Link
  label: string;
  url: string;
}

export interface DiscordMessagePayload {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: { type: 1; components: DiscordLinkButton[] }[]; // ActionRow
}

/**
 * Sends a direct message to a Discord user via the bot's REST API — no
 * gateway connection needed, just the bot token. Throws on failure (e.g. the
 * user has DMs from server members disabled, or doesn't share a guild with
 * the bot); callers that want this to be best-effort should catch it.
 */
export async function sendDiscordDirectMessage(
  discordUserId: string,
  payload: DiscordMessagePayload,
): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");

  const channelRes = await fetch(`${DISCORD_API_BASE}/users/@me/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (!channelRes.ok) {
    throw new Error(`Couldn't open a DM channel with ${discordUserId}: ${channelRes.status} ${await channelRes.text()}`);
  }
  const channel = (await channelRes.json()) as { id: string };

  const messageRes = await fetch(`${DISCORD_API_BASE}/channels/${channel.id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!messageRes.ok) {
    throw new Error(`Couldn't send DM to ${discordUserId}: ${messageRes.status} ${await messageRes.text()}`);
  }
}
