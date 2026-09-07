import { Badge, Card, CardContent, CardHeader } from "@repo/ui";
import { IntegrationIcon } from "@/components/settings/integration-icon";

export function TwitchIntegrationSection({ twitchUsername }: { twitchUsername: string | null }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-4 space-y-0">
        <IntegrationIcon provider="twitch" />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold leading-none">Twitch</h3>
            <Badge className="bg-[#9146FF] text-white">Connected</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            How you signed in. Can&apos;t be disconnected from here &mdash; it&apos;s the whole reason you have an account.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          Connected as <strong>{twitchUsername ?? "unknown"}</strong>
        </p>
      </CardContent>
    </Card>
  );
}
