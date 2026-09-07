import { DiscordMemberNotFoundError } from "./errors";

export interface DiscordApiConfig {
  botToken: string;
  guildId: string;
}

export class DiscordMembersClient {
  constructor(private readonly config: DiscordApiConfig) {}

  private async setRole(discordUserId: string, roleId: string, method: "PUT" | "DELETE"): Promise<void> {
    const action = method === "PUT" ? "assign" : "remove";
    const actionPast = method === "PUT" ? "assigned" : "removed";

    const response = await fetch(
      `https://discord.com/api/v10/guilds/${this.config.guildId}/members/${discordUserId}/roles/${roleId}`,
      {
        method,
        headers: { Authorization: `Bot ${this.config.botToken}` },
      }
    );

    if (!response.ok && response.status !== 204) {
      const body = await response.text();

      // Discord error code 10007 = "Unknown Member": the user hasn't joined
      // the guild yet, so there's no member to attach a role to.
      const parsedCode: unknown = (() => {
        try {
          return JSON.parse(body).code;
        } catch {
          return undefined;
        }
      })();
      if (response.status === 404 && parsedCode === 10007) {
        throw new DiscordMemberNotFoundError(discordUserId);
      }

      console.error(`[discord-api/members] Failed to ${action} role ${roleId} for user ${discordUserId}: ${response.status} ${body}`);
      throw new Error(`Discord role ${method} failed: ${response.status} ${body}`);
    }

    console.log(`[discord-api/members] Successfully ${actionPast} role ${roleId} for user ${discordUserId}`);
  }

  assignRole(discordUserId: string, roleId: string): Promise<void> {
    return this.setRole(discordUserId, roleId, "PUT");
  }

  removeRole(discordUserId: string, roleId: string): Promise<void> {
    return this.setRole(discordUserId, roleId, "DELETE");
  }

  // Fetches the role IDs currently held by a guild member. Returns null if
  // the user isn't a member of the guild (404), rather than throwing —
  // unlike assignRole/removeRole, "not a member" is the expected outcome of
  // a plain lookup, not an exceptional case callers need to special-case.
  async getRoleIds(discordUserId: string): Promise<string[] | null> {
    const response = await fetch(`https://discord.com/api/v10/guilds/${this.config.guildId}/members/${discordUserId}`, {
      headers: { Authorization: `Bot ${this.config.botToken}` },
    });

    if (response.status === 404) return null;

    if (!response.ok) {
      const body = await response.text();
      console.error(`[discord-api/members] Failed to fetch member ${discordUserId}: ${response.status} ${body}`);
      throw new Error(`Discord member lookup failed: ${response.status} ${body}`);
    }

    const member = (await response.json()) as { roles: string[] };
    return member.roles;
  }
}
