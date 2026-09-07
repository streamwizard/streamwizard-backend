import {
  sendDiscordChannelMessage,
  sendDiscordDirectMessage,
  DiscordRateLimitError,
  type DiscordMessagePayload,
} from "@repo/discord-api";
import {
  sendTelegramMessage,
  escapeTelegramHtml,
  TelegramRateLimitError,
} from "@repo/telegram-api";
import * as Sentry from "@sentry/core";
import { alertConfig } from "./config";
import type { AlertNotification, Env, NodeStats } from "./types";

// Tiered routing, editable from /alerts/notifications (alert_notification_config
// row per env, loaded each tick). Code defaults preserve the plan's policy:
// prod crit → Discord + Telegram, prod warn → Discord, staging → Discord,
// dev → alert_events only. Addresses fall back to ALERT_DISCORD_CHANNEL_ID /
// TELEGRAM_CHAT_ID; bot tokens always come from env — never the database.
// Resolved messages follow the route the alert fired on.

/** 'off' = never, 'warn' = warn and crit, 'crit' = crit only. */
export type SeverityGate = "off" | "warn" | "crit";

/** 'channel' → discordId is a channel ID; 'dm' → discordId is a USER ID. */
export type DiscordTarget = "channel" | "dm";

export interface EnvRoute {
  discordId?: string;
  discordTarget: DiscordTarget;
  discordSeverity: SeverityGate;
  telegramChatId?: string;
  telegramSeverity: SeverityGate;
}

export function defaultRoute(alertEnv: Env): EnvRoute {
  const base = {
    discordId: alertConfig.alertDiscordChannelId,
    discordTarget: "channel" as DiscordTarget,
    telegramChatId: alertConfig.telegramChatId,
  };
  switch (alertEnv) {
    case "prod":
      return { ...base, discordSeverity: "warn", telegramSeverity: "crit" };
    case "staging":
      return { ...base, discordSeverity: "warn", telegramSeverity: "off" };
    case "dev":
      return { ...base, discordSeverity: "off", telegramSeverity: "off" };
  }
}

/** Merge a DB config row over the code/env defaults. */
export function resolveRoute(
  alertEnv: Env,
  row?: {
    discord_channel_id: string | null;
    discord_target: string;
    discord_severity: string;
    telegram_chat_id: string | null;
    telegram_severity: string;
  } | null,
): EnvRoute {
  const dflt = defaultRoute(alertEnv);
  if (!row) return dflt;
  const discordTarget = row.discord_target as DiscordTarget;
  return {
    // The env fallback is a CHANNEL id — never reuse it as a DM user id.
    discordId:
      row.discord_channel_id ??
      (discordTarget === "channel" ? dflt.discordId : undefined),
    discordTarget,
    discordSeverity: row.discord_severity as SeverityGate,
    telegramChatId: row.telegram_chat_id ?? dflt.telegramChatId,
    telegramSeverity: row.telegram_severity as SeverityGate,
  };
}

const gateAllows = (gate: SeverityGate, severity: "warn" | "crit"): boolean =>
  gate === "warn" || (gate === "crit" && severity === "crit");

const SEVERITY_COLOR = { warn: 0xf59e0b, crit: 0xef4444 } as const;
const RESOLVED_COLOR = 0x22c55e;

/** Last-known node stats as inline embed fields (Discord lays them out
 * three per row). Only fields the node actually reports are shown. */
function statFields(
  s: NodeStats,
): { name: string; value: string; inline: boolean }[] {
  const gb = (mb: number) => (mb / 1024).toFixed(1);
  const pct = (used?: number, total?: number) =>
    used !== undefined && total !== undefined && total > 0
      ? `${((used / total) * 100).toFixed(0)}% (${gb(used)}/${gb(total)} GB)`
      : undefined;
  const entries: [string, string | undefined][] = [
    ["CPU", s.cpuPct !== undefined ? `${s.cpuPct.toFixed(0)}%` : undefined],
    ["RAM", pct(s.memUsedMb, s.memTotalMb)],
    [
      "GPU",
      s.gpuTempC !== undefined ? `${s.gpuTempC.toFixed(0)}°C` : undefined,
    ],
    ["VRAM", pct(s.vramUsedMb, s.vramTotalMb)],
    [
      "Bandwidth",
      s.bandwidthMbps !== undefined
        ? `${s.bandwidthMbps.toFixed(1)} Mbps`
        : undefined,
    ],
    ["Disk", s.diskPct !== undefined ? `${s.diskPct.toFixed(0)}%` : undefined],
    [
      "Instances",
      s.runningInstances !== undefined && s.maxInstances !== undefined
        ? `${s.runningInstances}/${s.maxInstances}`
        : undefined,
    ],
  ];
  return entries.flatMap(([name, value]) =>
    value === undefined ? [] : [{ name, value, inline: true }],
  );
}

function discordPayload(n: AlertNotification): DiscordMessagePayload {
  const icon =
    n.kind === "resolved" ? "✅" : n.severity === "crit" ? "🚨" : "⚠️";
  const label =
    n.kind === "resolved"
      ? "resolved"
      : n.kind === "renotified"
        ? `still firing (${n.severity})`
        : n.severity;
  const firedAtUnix = n.firedAt
    ? Math.floor(new Date(n.firedAt).getTime() / 1000)
    : undefined;
  const monitorUrl = alertConfig.monitorBaseUrl;

  const fields: { name: string; value: string; inline?: boolean }[] = [];
  if (n.node) {
    fields.push({ name: "Node", value: n.node.name, inline: true });
    // Code formatting so the address is tap-to-copy in Discord.
    if (n.node.address)
      fields.push({
        name: n.node.kind === "ingest" ? "IP" : "API",
        value: `\`${n.node.address}\``,
        inline: true,
      });
  } else if (n.entityId) {
    fields.push({
      name: "Entity",
      value: n.entityLabel ?? n.entityId,
      inline: true,
    });
  }
  // <t:...:R> renders as a live relative time ("2 hours ago") in Discord.
  if (firedAtUnix !== undefined) {
    fields.push({
      name: n.kind === "resolved" ? "Was firing since" : "Firing since",
      value: `<t:${firedAtUnix}:R>`,
      inline: true,
    });
  }
  if (n.node?.stats) fields.push(...statFields(n.node.stats));

  return {
    embeds: [
      {
        title: `${icon} [${n.env}] ${n.ruleTitle} — ${label}`,
        description: n.message,
        color:
          n.kind === "resolved" ? RESOLVED_COLOR : SEVERITY_COLOR[n.severity],
        fields,
        // Technical ids stay greppable without cluttering the fields.
        footer: { text: n.entityId ? `${n.ruleId} · ${n.entityId}` : n.ruleId },
        timestamp: new Date().toISOString(),
      },
    ],
    ...(monitorUrl
      ? {
          components: [
            {
              type: 1 as const,
              components: [
                {
                  type: 2 as const,
                  style: 5 as const,
                  label: "Open dashboard",
                  url: `${monitorUrl.replace(/\/$/, "")}/alerts`,
                },
              ],
            },
          ],
        }
      : {}),
  };
}

function telegramText(n: AlertNotification): string {
  const icon = n.kind === "resolved" ? "✅" : "🚨";
  const label =
    n.kind === "resolved"
      ? "resolved"
      : n.kind === "renotified"
        ? "still firing"
        : "FIRING";
  const entity = n.entityLabel ?? n.entityId;
  const entitySuffix = entity ? ` (${escapeTelegramHtml(entity)})` : "";
  return `${icon} <b>[${n.env}] ${escapeTelegramHtml(n.ruleTitle)}</b>${entitySuffix} — ${label}\n${escapeTelegramHtml(n.message)}`;
}

async function withRetries(send: () => Promise<void>): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      await send();
      return;
    } catch (err) {
      lastError = err;
      const retryAfterS =
        err instanceof DiscordRateLimitError ||
        err instanceof TelegramRateLimitError
          ? err.retryAfterSeconds
          : 2 ** attempt; // 1s, 2s backoff
      if (attempt < 2)
        await new Promise((r) =>
          setTimeout(r, Math.min(retryAfterS, 10) * 1000),
        );
    }
  }
  throw lastError;
}

export interface DispatchResult {
  /** (ruleId, entityId) pairs whose delivery completely failed. */
  failed: { ruleId: string; entityId: string }[];
}

export async function dispatchNotifications(
  notifications: AlertNotification[],
  route: EnvRoute,
): Promise<DispatchResult> {
  const failed: { ruleId: string; entityId: string }[] = [];

  for (const n of notifications) {
    const sends: Promise<void>[] = [];
    const discordGateOpen = gateAllows(route.discordSeverity, n.severity);
    const telegramGateOpen = gateAllows(route.telegramSeverity, n.severity);
    if (route.discordId && alertConfig.discordBotToken && discordGateOpen) {
      const discordId = route.discordId;
      const send =
        route.discordTarget === "dm"
          ? () => sendDiscordDirectMessage(discordId, discordPayload(n))
          : () => sendDiscordChannelMessage(discordId, discordPayload(n));
      sends.push(withRetries(send));
    }
    if (route.telegramChatId && alertConfig.telegramBotToken && telegramGateOpen) {
      const chatId = route.telegramChatId;
      sends.push(
        withRetries(() => sendTelegramMessage(telegramText(n), { chatId })),
      );
    }
    if (sends.length === 0) {
      // A gate said "notify" but no channel could carry it (missing channel id,
      // chat id, or bot token). Silence here once hid a fully broken staging
      // pipeline — surface it as a delivery failure instead of a quiet skip.
      // Gates that are deliberately closed (e.g. dev routes everything to the
      // database only) are not a misconfiguration and still skip silently.
      const misconfigured =
        (discordGateOpen && (!route.discordId || !alertConfig.discordBotToken)) ||
        (telegramGateOpen && (!route.telegramChatId || !alertConfig.telegramBotToken));
      if (misconfigured) {
        failed.push({ ruleId: n.ruleId, entityId: n.entityId });
        Sentry.captureMessage(
          `Alert notification for ${n.ruleId} passed its severity gate but no channel is configured`,
          "warning",
        );
      }
      continue;
    }

    const results = await Promise.allSettled(sends);
    if (results.every((r) => r.status === "rejected")) {
      failed.push({ ruleId: n.ruleId, entityId: n.entityId });
      for (const r of results) {
        if (r.status === "rejected") Sentry.captureException(r.reason);
      }
    } else {
      for (const r of results) {
        if (r.status === "rejected") Sentry.captureException(r.reason);
      }
    }
  }

  return { failed };
}
