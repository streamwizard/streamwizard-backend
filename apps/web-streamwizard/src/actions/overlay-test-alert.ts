"use server";

import { createClient } from "@repo/supabase/next/server";
import { reportError } from "@repo/sentry";
import {
  DEMO_EVENTS,
  DEMO_EVENT_DEFS,
  buildDemoEvent,
  isDemoEventType,
} from "@repo/schemas";
import { broadcastToUser } from "@repo/ws-client";
import { env } from "@/lib/env";

/**
 * A looping simulator in Live mode is one round trip per tick, per open editor
 * tab. Without a ceiling a streamer can quietly flood their own ws-server just
 * by leaving the panel running. Generous enough that no hand-firing hits it.
 */
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

// Per server instance, not per cluster -- this is a guard rail against a stuck
// loop, not a security control. The allowlist above is the security control.
const rateLimitByUser = new Map<string, { count: number; windowStart: number }>();

function withinRateLimit(userId: string, now: number): boolean {
  const entry = rateLimitByUser.get(userId);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitByUser.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

/**
 * Fires a synthetic event at the signed-in user's overlay WS room via ws-server
 * `/internal/broadcast`. The message uses the real listener string, so the
 * native alert widget AND custom widgets react exactly like they would to a
 * live one -- and every overlay the user has open sees it, not just the editor
 * preview.
 *
 * `event` arrives from the client, so it is checked against the demo catalogue
 * rather than trusted -- that table is the allowlist of broadcastable types.
 */
export async function sendTestEventToOverlay(
  event: string,
  /**
   * Optional hand-edited payload from the widget editor. Validated against the
   * event's own zod schema before it goes anywhere, so a typo surfaces as an
   * error instead of a malformed frame reaching live overlays.
   */
  customPayload?: unknown,
  /**
   * Picks an alternate payload for the same listener -- which chat notice to
   * send, for instance. Checked against the event's own variant table for the
   * same reason `event` is checked against the catalogue.
   */
  variant?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isDemoEventType(event)) {
    return { ok: false, error: "Unknown event type" };
  }

  // DEMO_EVENT_DEFS is the widened view; DEMO_EVENTS keeps its literal types,
  // so only some of its members declare `variants` at all.
  if (variant !== undefined && !DEMO_EVENT_DEFS[event].variants?.[variant]) {
    return { ok: false, error: "Unknown event variant" };
  }

  if (customPayload !== undefined) {
    const parsed = DEMO_EVENTS[event].schema.safeParse(customPayload);
    if (!parsed.success) {
      return { ok: false, error: `Payload doesn't match ${event}` };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Not signed in" };

  if (!withinRateLimit(user.id, Date.now())) {
    return { ok: false, error: "Too many test events — slow down for a minute" };
  }

  if (!env.CONSUMER_SECRET) {
    return { ok: false, error: "Test alerts aren't configured on this server" };
  }

  const msg =
    customPayload === undefined
      ? buildDemoEvent(event, undefined, variant)
      : { type: event, payload: customPayload };
  const result = await broadcastToUser(user.id, msg.type, msg.payload, {
    wsServerUrl: env.WS_SERVER_URL,
    consumerSecret: env.CONSUMER_SECRET,
  });
  if (result.ok) return { ok: true };
  if (result.reason === "network") reportError(result.error, "overlay: test alert broadcast");
  return { ok: false, error: "Could not reach the overlay server" };
}
