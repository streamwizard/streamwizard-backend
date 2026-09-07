import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getAlertStates } from "@repo/supabase/queries/alerts";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { SilenceMenu } from "@/components/alerts/silence-menu";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatusIndicator, type IndicatorStatus } from "@/components/widgets/status-indicator";
import { homeEnv } from "@/lib/home-env";

export const dynamic = "force-dynamic";

function severityStatus(severity: string | null): IndicatorStatus {
  return severity === "crit" ? "crit" : severity === "warn" ? "warn" : "muted";
}

function formatSince(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  return `${Math.floor(mins / (60 * 24))}d ago`;
}

export default async function AlertsPage() {
  const env = homeEnv();
  const states = await getAlertStates(supabaseAdmin, env);
  const now = Date.now();

  const firing = states
    .filter((s) => s.status === "firing")
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "crit" ? -1 : 1));
  const silencedCount = firing.filter(
    (s) => s.silenced_until && new Date(s.silenced_until).getTime() > now,
  ).length;
  const critCount = firing.filter((s) => s.severity === "crit").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Active alerts" description={`Alert state for ${env} · evaluated every minute`} />

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Firing"
          value={firing.length}
          description={firing.length === 0 ? "All quiet" : "Across all rules"}
          className={firing.length > 0 ? "border-destructive/50" : undefined}
        />
        <StatCard title="Critical" value={critCount} description="Firing at crit severity" />
        <StatCard title="Silenced" value={silencedCount} description="Firing but muted" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Firing now</CardTitle>
        </CardHeader>
        <CardContent>
          {firing.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nothing is firing. Rule states appear here the moment a breach passes its debounce.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead>Last notified</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firing.map((s) => {
                  const silenced = !!s.silenced_until && new Date(s.silenced_until).getTime() > now;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <StatusIndicator status={severityStatus(s.severity)} label={s.severity ?? "—"} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.rule_id}</TableCell>
                      <TableCell className="font-mono text-xs">{s.entity_id || "—"}</TableCell>
                      <TableCell className="max-w-sm truncate text-muted-foreground" title={s.message ?? undefined}>
                        {s.message ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatSince(s.first_fired_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {s.notify_failed ? (
                          <Badge variant="outline" className="border-red-500/40 text-red-600 dark:text-red-400">
                            notify failed
                          </Badge>
                        ) : (
                          formatSince(s.last_notified_at)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <SilenceMenu stateId={s.id} silenced={silenced} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Watching {states.length} rule/entity {states.length === 1 ? "pair" : "pairs"} in {env}. Silencing mutes
        notifications only — state and history keep recording.
      </p>
    </div>
  );
}
