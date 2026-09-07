import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import { TwitchApi } from "@repo/twitch-api";

// Chat notices ride the app token but speak as the *broadcaster* (see
// packages/twitch-api/src/chat.ts) — the switcher is acting on the streamer's
// behalf, so the message reads as them, same as the deck send path. Works in
// any channel that granted user:bot + channel:bot, no per-user token needed.
// Failures are soft: a chat hiccup must never affect switching.

/** Which notice this is. Also the rate-limit bucket — see RATE_LIMIT_MS. */
export type ChatNoticeKind = "degraded" | "offline" | "recovered";

const NOTICE_KINDS: ChatNoticeKind[] = ["degraded", "offline", "recovered"];

// Per user *and* per kind. Keyed on the user alone, a recovery landing inside
// 30s of the fallback that caused it was silently dropped, leaving "connection
// unstable" as chat's last word on a stream that had already come back.
const RATE_LIMIT_MS = 30_000;

// A send that never reached chat (AutoMod hold, missing scope, Twitch 5xx) must
// not cost the full window — the next notice is allowed this soon instead.
const FAILED_RETRY_MS = 5_000;

// Helix caps a chat message at 500 characters and rejects the whole request
// past that. Templates are capped at 400 by the schema, but {scene} expands to
// an arbitrary OBS scene name, so the rendered string can still cross it.
const MAX_MESSAGE_LENGTH = 500;

// Same shape as the instance cache in obs-client.ts: TTL'd rather than
// permanent. A permanent cache meant a user who linked Twitch after the worker
// booted had `null` pinned for the life of the process and never got a notice.
// Misses expire faster than hits precisely because that is the case worth
// re-checking.
const BROADCASTER_TTL_MS = 300_000;
const BROADCASTER_MISS_TTL_MS = 60_000;

const broadcasterIdCache = new Map<string, { id: string | null; at: number }>();
const lastSentAt = new Map<string, number>();

export interface ChatTemplateVars {
  bitrate?: number;
  rtt?: number;
  loss?: number;
  scene?: string;
}

export function renderChatTemplate(
  template: string,
  vars: ChatTemplateVars,
): string {
  const rendered = template
    .replaceAll(
      "{bitrate}",
      vars.bitrate !== undefined ? String(Math.round(vars.bitrate)) : "?",
    )
    .replaceAll(
      "{rtt}",
      vars.rtt !== undefined ? String(Math.round(vars.rtt)) : "?",
    )
    .replaceAll("{loss}", vars.loss !== undefined ? vars.loss.toFixed(1) : "?")
    .replaceAll("{scene}", vars.scene ?? "?")
    .trim();
  return rendered.length > MAX_MESSAGE_LENGTH
    ? rendered.slice(0, MAX_MESSAGE_LENGTH)
    : rendered;
}

async function getBroadcasterId(userId: string): Promise<string | null> {
  const cached = broadcasterIdCache.get(userId);
  if (cached) {
    const ttl = cached.id ? BROADCASTER_TTL_MS : BROADCASTER_MISS_TTL_MS;
    if (Date.now() - cached.at < ttl) return cached.id;
  }
  const broadcasterId = await getTwitchUserIdByUserIdMaybe(supabase, userId);
  broadcasterIdCache.set(userId, { id: broadcasterId, at: Date.now() });
  return broadcasterId;
}

/** Drops a user's cached broadcaster id and rate-limit windows. */
export function clearChatCaches(userId: string): void {
  broadcasterIdCache.delete(userId);
  for (const kind of NOTICE_KINDS) lastSentAt.delete(`${userId}:${kind}`);
}

/** Sends a chat notice; silently no-ops without a Twitch link or inside the per-kind rate limit. */
export async function sendChatNotice(
  userId: string,
  kind: ChatNoticeKind,
  template: string,
  vars: ChatTemplateVars,
): Promise<void> {
  const key = `${userId}:${kind}`;
  const now = Date.now();
  const last = lastSentAt.get(key) ?? 0;
  if (now - last < RATE_LIMIT_MS) return;

  const message = renderChatTemplate(template, vars);
  // A cleared template is valid config (the schema has no minimum) and Helix
  // 400s on an empty message, so treat it as "this notice is off".
  if (!message) return;

  try {
    const broadcasterId = await getBroadcasterId(userId);
    if (!broadcasterId) return;

    // Stamped before the request so an unreachable Twitch can't be hammered
    // once per switch; rolled back below if the message never landed.
    lastSentAt.set(key, now);
    const response = await new TwitchApi(broadcasterId).chat.sendMessage({
      message,
      sender: "broadcaster",
    });

    // Helix answers 200 with is_sent:false when AutoMod holds a message, so a
    // successful HTTP call is not on its own proof that chat saw anything.
    const sent = response?.data?.[0];
    if (sent && sent.is_sent === false) {
      lastSentAt.set(key, now - RATE_LIMIT_MS + FAILED_RETRY_MS);
      reportError(
        new Error(
          `chat notice held by Twitch: ${sent.drop_reason?.code ?? "unknown"}`,
        ),
        "chat.notice",
        { userId, kind, dropReason: sent.drop_reason?.message ?? null },
      );
    }
  } catch (err) {
    lastSentAt.set(key, now - RATE_LIMIT_MS + FAILED_RETRY_MS);
    reportError(err, "chat.notice", { userId, kind });
  }
}
