"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import {
  saveNotificationConfig,
  sendTestNotification,
  type TestSendResult,
} from "@/actions/alert-notifications";

type EnvName = "prod" | "staging" | "dev";
type SeverityGate = "off" | "warn" | "crit";
type DiscordTarget = "channel" | "dm";

const GATE_LABELS: Record<SeverityGate, string> = {
  off: "Off",
  warn: "Warn + crit",
  crit: "Crit only",
};

export interface EnvNotifyView {
  env: EnvName;
  hasRow: boolean;
  discordChannelId: string | null;
  discordTarget: DiscordTarget;
  discordSeverity: SeverityGate;
  telegramChatId: string | null;
  telegramSeverity: SeverityGate;
}

export interface TokenStatus {
  discordToken: boolean;
  telegramToken: boolean;
  discordChannelFallback: boolean;
  telegramChatFallback: boolean;
}

function SeveritySelect({
  value,
  onChange,
  disabled,
}: {
  value: SeverityGate;
  onChange: (v: SeverityGate) => void;
  disabled: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SeverityGate)} disabled={disabled}>
      <SelectTrigger className="h-8 w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(GATE_LABELS) as SeverityGate[]).map((gate) => (
          <SelectItem key={gate} value={gate}>
            {GATE_LABELS[gate]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EnvCard({ view, tokens, isHome }: { view: EnvNotifyView; tokens: TokenStatus; isHome: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [discordId, setDiscordId] = useState(view.discordChannelId ?? "");
  const [discordTarget, setDiscordTarget] = useState<DiscordTarget>(view.discordTarget);
  const [discordSeverity, setDiscordSeverity] = useState<SeverityGate>(view.discordSeverity);
  const [telegramId, setTelegramId] = useState(view.telegramChatId ?? "");
  const [telegramSeverity, setTelegramSeverity] = useState<SeverityGate>(view.telegramSeverity);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestSendResult | null>(null);

  const dirty =
    (discordId.trim() || null) !== view.discordChannelId ||
    discordTarget !== view.discordTarget ||
    discordSeverity !== view.discordSeverity ||
    (telegramId.trim() || null) !== view.telegramChatId ||
    telegramSeverity !== view.telegramSeverity;

  const save = () =>
    startTransition(async () => {
      setError(null);
      try {
        await saveNotificationConfig({
          env: view.env,
          discordChannelId: discordId.trim() || null,
          discordTarget,
          discordSeverity,
          telegramChatId: telegramId.trim() || null,
          telegramSeverity,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save");
      }
    });

  const test = (channel: "discord" | "telegram") =>
    startTransition(async () => {
      setTestResult(null);
      const result = await sendTestNotification(view.env, channel);
      setTestResult(result);
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="uppercase">{view.env}</span>
          {isHome && <Badge variant="outline">this deployment</Badge>}
          {view.hasRow && (
            <Badge variant="outline" className="text-[10px]">
              customized
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[6rem_auto_1fr_auto_auto] items-center gap-2">
          <span className="text-sm">Discord</span>
          <Select value={discordTarget} onValueChange={(v) => setDiscordTarget(v as DiscordTarget)} disabled={isPending}>
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="channel">Channel</SelectItem>
              <SelectItem value="dm">DM</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder={
              discordTarget === "dm"
                ? "user ID"
                : tokens.discordChannelFallback
                  ? "using env default channel"
                  : "channel ID"
            }
            disabled={isPending}
            className="h-8 font-mono text-xs"
          />
          <SeveritySelect value={discordSeverity} onChange={setDiscordSeverity} disabled={isPending} />
          <Button size="sm" variant="outline" className="h-8" onClick={() => test("discord")} disabled={isPending}>
            Test
          </Button>

          <span className="text-sm">Telegram</span>
          <span className="text-xs text-muted-foreground">chat</span>
          <Input
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            placeholder={tokens.telegramChatFallback ? "using env default chat" : "chat ID"}
            disabled={isPending}
            className="h-8 font-mono text-xs"
          />
          <SeveritySelect value={telegramSeverity} onChange={setTelegramSeverity} disabled={isPending} />
          <Button size="sm" variant="outline" className="h-8" onClick={() => test("telegram")} disabled={isPending}>
            Test
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs">
            {error && <span className="text-destructive">{error}</span>}
            {testResult && (
              <StatusIndicator
                status={testResult.ok ? "ok" : "crit"}
                label={testResult.detail}
                className="text-xs"
              />
            )}
          </div>
          {dirty && (
            <Button size="sm" className="h-7" onClick={save} disabled={isPending}>
              Save
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function NotificationsEditor({
  envs,
  tokens,
  homeEnv,
}: {
  envs: EnvNotifyView[];
  tokens: TokenStatus;
  homeEnv: EnvName;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-xs">
        <StatusIndicator
          status={tokens.discordToken ? "ok" : "muted"}
          label={tokens.discordToken ? "Discord bot token configured" : "DISCORD_BOT_TOKEN missing (set in Doppler)"}
        />
        <StatusIndicator
          status={tokens.telegramToken ? "ok" : "muted"}
          label={tokens.telegramToken ? "Telegram bot token configured" : "TELEGRAM_BOT_TOKEN missing (set in Doppler)"}
        />
      </div>
      {envs.map((view) => (
        <EnvCard key={view.env} view={view} tokens={tokens} isHome={view.env === homeEnv} />
      ))}
    </div>
  );
}
