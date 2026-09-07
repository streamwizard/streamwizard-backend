import { sendDiscordDirectMessage } from "@repo/discord-api";
import { trackEventSubConnection } from "@repo/metrics";
import { reportError } from "@repo/sentry";
import type { EventSubLifecycleEvent } from "@repo/twitch-eventsub";
import { Sentry } from "../sentry";
import { env } from "./env";

const SERVICE = "streamwizard-bot";

/** Only DM after the connection has been down this long — short blips stay silent. */
const ALERT_AFTER_MS = 60_000;
/** Send one "still down" escalation DM after this long. */
const ESCALATE_AFTER_MS = 15 * 60_000;
/** Throttle window for revocation/conduit-failure DMs, per key. */
const MISC_THROTTLE_MS = 10 * 60_000;

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

async function safeDm(content: string): Promise<void> {
  if (!env.DISCORD_ALERT_USER_ID || !env.DISCORD_BOT_TOKEN) return;
  try {
    await sendDiscordDirectMessage(env.DISCORD_ALERT_USER_ID, { content });
  } catch (error) {
    // The alert channel itself is down; Sentry is the only remaining way to
    // find out, so this needs to be an issue rather than a breadcrumb on some
    // later event that may never be sent.
    reportError(error, "alerting.discord-dm");
  }
}

/**
 * Turns receiver lifecycle events into Discord DMs, Sentry reports, and
 * connection metrics. Deduped so a flapping connection doesn't spam: one DM
 * when an outage exceeds one minute, one escalation at 15 minutes, one on
 * recovery.
 */
export function createEventSubAlerter(): (event: EventSubLifecycleEvent) => void {
  let outageStartedAt: number | null = null;
  let outageAttempts = 0;
  let outageAlerted = false;
  let alertTimer: NodeJS.Timeout | null = null;
  let escalateTimer: NodeJS.Timeout | null = null;
  const lastMiscAlertAt = new Map<string, number>();

  const clearOutageTimers = () => {
    if (alertTimer) clearTimeout(alertTimer);
    if (escalateTimer) clearTimeout(escalateTimer);
    alertTimer = null;
    escalateTimer = null;
  };

  const onOutageStart = (reason: string) => {
    if (outageStartedAt !== null) return; // already tracking this outage
    outageStartedAt = Date.now();
    outageAttempts = 0;
    outageAlerted = false;
    Sentry.addBreadcrumb({ category: "eventsub", message: `Connection lost: ${reason}`, level: "warning" });

    alertTimer = setTimeout(() => {
      alertTimer = null;
      if (outageStartedAt === null) return;
      outageAlerted = true;
      const downFor = formatDuration(Date.now() - outageStartedAt);
      const message = `🔴 **EventSub connection lost** (${reason}) — down for ${downFor}, ${outageAttempts} reconnect attempt(s) so far. The bot keeps retrying automatically.`;
      console.error(`[alert] ${message}`);
      Sentry.captureMessage(`EventSub connection lost: ${reason}`, "error");
      void safeDm(message);
    }, ALERT_AFTER_MS);

    escalateTimer = setTimeout(() => {
      escalateTimer = null;
      if (outageStartedAt === null) return;
      const downFor = formatDuration(Date.now() - outageStartedAt);
      const message = `🔴 **EventSub still down** after ${downFor} (${outageAttempts} reconnect attempts). Check Twitch status and the bot's network.`;
      console.error(`[alert] ${message}`);
      Sentry.captureMessage("EventSub still down after 15 minutes", "error");
      void safeDm(message);
    }, ESCALATE_AFTER_MS);
  };

  const throttledMiscAlert = (key: string, message: string, error?: unknown) => {
    const last = lastMiscAlertAt.get(key) ?? 0;
    if (Date.now() - last < MISC_THROTTLE_MS) return;
    lastMiscAlertAt.set(key, Date.now());
    console.error(`[alert] ${message}`);
    if (error !== undefined) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(message, "warning");
    }
    void safeDm(message);
  };

  return (event: EventSubLifecycleEvent) => {
    switch (event.type) {
      case "connection_lost":
        trackEventSubConnection(SERVICE, "lost");
        onOutageStart(event.reason + (event.code !== null ? ` (code ${event.code})` : ""));
        break;

      case "keepalive_timeout":
        // handleConnectionLoss follows right after and starts the outage;
        // just leave a trail for debugging.
        Sentry.addBreadcrumb({
          category: "eventsub",
          message: `Keepalive timeout after ${event.silentForMs}ms of silence`,
          level: "warning",
        });
        break;

      case "reconnect_scheduled":
        outageAttempts = event.attempt;
        trackEventSubConnection(SERVICE, "reconnect_attempt", { attempt: event.attempt });
        break;

      case "connected": {
        trackEventSubConnection(SERVICE, "connected", {
          downtimeMs: event.downtimeMs ?? undefined,
          attempt: event.attempt,
        });
        clearOutageTimers();
        if (outageAlerted && event.downtimeMs !== null) {
          const message = `🟢 **EventSub reconnected** after ${formatDuration(event.downtimeMs)} (${event.attempt} attempt(s)). Session \`${event.sessionId}\`.`;
          console.log(`[alert] ${message}`);
          Sentry.captureMessage("EventSub reconnected", "info");
          void safeDm(message);
        }
        outageStartedAt = null;
        outageAttempts = 0;
        outageAlerted = false;
        break;
      }

      case "session_reconnect_requested":
        // Routine Twitch-side migration, not an outage
        Sentry.addBreadcrumb({ category: "eventsub", message: "Twitch requested session reconnect", level: "info" });
        break;

      case "subscription_revoked":
        throttledMiscAlert(
          `revoked:${event.subscriptionType}`,
          `⚠️ **EventSub subscription revoked**: \`${event.subscriptionType}\` (${event.status}) — ${event.reason}`,
        );
        break;

      case "conduit_update_failed":
        throttledMiscAlert(
          "conduit_update_failed",
          "🔴 **EventSub conduit shard update failed** after retries — the bot is connected but may not receive events. Investigate ASAP.",
          event.error,
        );
        break;
    }
  };
}
