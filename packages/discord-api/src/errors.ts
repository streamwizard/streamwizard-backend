// Thrown when Discord rejects a role grant/revoke because the user isn't a
// member of the guild (e.g. they OAuth'd on the website before joining the
// server). This is an expected, user-facing case — not a real failure — so
// callers should handle it distinctly from other errors.
export class DiscordMemberNotFoundError extends Error {
  constructor(discordUserId: string) {
    super(`Discord user ${discordUserId} is not a member of the guild`);
    this.name = "DiscordMemberNotFoundError";
  }
}
