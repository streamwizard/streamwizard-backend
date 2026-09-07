"use server";

import { revalidatePath } from "next/cache";
import { sendDiscordChannelMessage, sendDiscordDirectMessage } from "@repo/discord-api";
import { sendTelegramMessage } from "@repo/telegram-api";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  getAlertNotificationConfigs,
  upsertAlertNotificationConfig,
} from "@repo/supabase/queries/alert-notification-config";
import { assertAdmin } from "@/lib/assert-admin";
import { resolveRoute, type DiscordTarget, type SeverityGate } from "@repo/alerting/notify";
import { env } from "@/lib/env";
import type { Env } from "@repo/alerting/types";

const ALL_ENVS: Env[] = ["prod", "staging", "dev"];
const GATES: SeverityGate[] = ["off", "warn", "crit"];

export interface NotificationConfigInput {
  env: Env;
  /** Channel ID or (for target 'dm') user ID; null = fall back to the env var. */
  discordChannelId: string | null;
  discordTarget: DiscordTarget;
  discordSeverity: SeverityGate;
  telegramChatId: string | null;
  telegramSeverity: SeverityGate;
}

export async function saveNotificationConfig(input: NotificationConfigInput): Promise<void> {
  const userId = await assertAdmin();

  if (!ALL_ENVS.includes(input.env)) throw new Error(`Unknown env: ${input.env}`);
  if (!GATES.includes(input.discordSeverity) || !GATES.includes(input.telegramSeverity))
    throw new Error("Severity must be off, warn, or crit");
  if (input.discordTarget !== "channel" && input.discordTarget !== "dm")
    throw new Error("Discord target must be channel or dm");

  await upsertAlertNotificationConfig(supabaseAdmin, {
    env: input.env,
    discord_channel_id: input.discordChannelId?.trim() || null,
    discord_target: input.discordTarget,
    discord_severity: input.discordSeverity,
    telegram_chat_id: input.telegramChatId?.trim() || null,
    telegram_severity: input.telegramSeverity,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/alerts/notifications");
}

export interface TestSendResult {
  ok: boolean;
  detail: string;
}

/** Fire a test message through the SAVED config for an env — proves tokens,
 * addresses, and permissions before a real alert needs them. */
export async function sendTestNotification(alertEnv: Env, channel: "discord" | "telegram"): Promise<TestSendResult> {
  await assertAdmin();
  if (!ALL_ENVS.includes(alertEnv)) return { ok: false, detail: `Unknown env: ${alertEnv}` };

  let route = resolveRoute(alertEnv);
  try {
    const rows = await getAlertNotificationConfigs(supabaseAdmin);
    route = resolveRoute(alertEnv, rows.find((r) => r.env === alertEnv) ?? null);
  } catch {
    // fall through with env/code defaults
  }

  try {
    if (channel === "discord") {
      if (!env.DISCORD_BOT_TOKEN) return { ok: false, detail: "DISCORD_BOT_TOKEN is not set on this deployment" };
      if (!route.discordId)
        return {
          ok: false,
          detail: route.discordTarget === "dm" ? "No Discord user ID configured" : "No Discord channel ID configured (table or env)",
        };
      const payload = {
        embeds: [
          {
            title: `🧪 [${alertEnv}] Test notification`,
            description: "Sent from the StreamWizard monitor notifications page. If you can read this, the pipe works.",
            color: 0x3b82f6,
          },
        ],
      };
      if (route.discordTarget === "dm") {
        await sendDiscordDirectMessage(route.discordId, payload);
        return { ok: true, detail: `DM sent to user ${route.discordId}` };
      }
      await sendDiscordChannelMessage(route.discordId, payload);
      return { ok: true, detail: `Sent to channel ${route.discordId}` };
    }

    if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, detail: "TELEGRAM_BOT_TOKEN is not set on this deployment" };
    if (!route.telegramChatId) return { ok: false, detail: "No Telegram chat ID configured (table or env)" };
    await sendTelegramMessage(`🧪 <b>[${alertEnv}] Test notification</b>\nSent from the StreamWizard monitor.`, {
      chatId: route.telegramChatId,
    });
    return { ok: true, detail: `Sent to chat ${route.telegramChatId}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
