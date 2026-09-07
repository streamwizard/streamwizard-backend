import type { GuildMember } from "discord.js";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getCommandRoles } from "@repo/supabase/queries/discord";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { roleIds: string[]; expiresAt: number }>();

function cacheKey(guildId: string, commandName: string) {
  return `${guildId}:${commandName}`;
}

async function getAllowedRoleIds(guildId: string, commandName: string): Promise<string[]> {
  const key = cacheKey(guildId, commandName);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.roleIds;

  let roleIds: string[] = [];
  try {
    const rows = await getCommandRoles(supabase, guildId, commandName);
    roleIds = rows.map((row) => row.role_id);
  } catch (error) {
    // Fails open — an unreadable role config means every role may run the
    // command, and the empty result is then cached for the full TTL. That is a
    // permission check quietly turning itself off; it belongs in Sentry.
    reportError(error, "permissions.load-role-config", { guildId, commandName });
  }

  cache.set(key, { roleIds, expiresAt: Date.now() + CACHE_TTL_MS });
  return roleIds;
}

// Call after add/remove so the change takes effect immediately instead of
// waiting out the cache TTL.
export function invalidateCommandPermissionCache(guildId: string, commandName: string) {
  cache.delete(cacheKey(guildId, commandName));
}

// A command with no configured roles is open to everyone in the guild.
// Outside a guild (DMs) there's no role context to check against, so commands
// run unrestricted there.
export async function canRunCommand(member: GuildMember | null, commandName: string): Promise<boolean> {
  if (!member) return true;

  const allowedRoleIds = await getAllowedRoleIds(member.guild.id, commandName);
  if (allowedRoleIds.length === 0) return true;

  return allowedRoleIds.some((roleId) => member.roles.cache.has(roleId));
}
