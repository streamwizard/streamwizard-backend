import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  getAlertNotificationConfigs,
  type AlertNotificationConfig,
} from "@repo/supabase/queries/alert-notification-config";
import { PageHeader } from "@/components/widgets/page-header";
import { NotificationsEditor, type EnvNotifyView } from "@/components/alerts/notifications-editor";
import { defaultRoute } from "@repo/alerting/notify";
import { homeEnv } from "@/lib/home-env";
import { env } from "@/lib/env";
import type { Env } from "@repo/alerting/types";

export const dynamic = "force-dynamic";

const ALL_ENVS: Env[] = ["prod", "staging", "dev"];

export default async function AlertNotificationsPage() {
  let rows: AlertNotificationConfig[] = [];
  try {
    rows = await getAlertNotificationConfigs(supabaseAdmin);
  } catch {
    // Table unreachable — page renders code defaults.
  }
  const byEnv = new Map(rows.map((r) => [r.env, r]));

  const envs: EnvNotifyView[] = ALL_ENVS.map((alertEnv) => {
    const row = byEnv.get(alertEnv);
    const dflt = defaultRoute(alertEnv);
    return {
      env: alertEnv,
      hasRow: row !== undefined,
      discordChannelId: row?.discord_channel_id ?? null,
      discordTarget: (row?.discord_target ?? dflt.discordTarget) as EnvNotifyView["discordTarget"],
      discordSeverity: (row?.discord_severity ?? dflt.discordSeverity) as EnvNotifyView["discordSeverity"],
      telegramChatId: row?.telegram_chat_id ?? null,
      telegramSeverity: (row?.telegram_severity ?? dflt.telegramSeverity) as EnvNotifyView["telegramSeverity"],
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Where alerts go, per environment. Bot tokens stay in Doppler; this page manages addresses and severity policy. Empty ID fields fall back to the env vars."
      />
      <NotificationsEditor
        envs={envs}
        tokens={{
          discordToken: !!env.DISCORD_BOT_TOKEN,
          telegramToken: !!env.TELEGRAM_BOT_TOKEN,
          discordChannelFallback: !!env.ALERT_DISCORD_CHANNEL_ID,
          telegramChatFallback: !!env.TELEGRAM_CHAT_ID,
        }}
        homeEnv={homeEnv()}
      />
    </div>
  );
}
