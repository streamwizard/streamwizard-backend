import Link from "next/link";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listAlertEvents } from "@repo/supabase/queries/alerts";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { PageHeader } from "@/components/widgets/page-header";
import { homeEnv } from "@/lib/home-env";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const EVENT_BADGE_CLASSES: Record<string, string> = {
  fired: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  renotified: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  resolved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  notify_failed: "border-red-500/40 text-red-600 dark:text-red-400",
  silenced: "text-muted-foreground",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function AlertHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const { before } = await searchParams;
  const env = homeEnv();
  // Fetch one extra row to know whether an older page exists.
  const events = await listAlertEvents(supabaseAdmin, { env, before, limit: PAGE_SIZE + 1 });
  const page = events.slice(0, PAGE_SIZE);
  const hasOlder = events.length > PAGE_SIZE;
  const oldest = page.at(-1);

  return (
    <div className="space-y-6">
      <PageHeader title="Alert history" description={`Append-only event log for ${env}`}>
        {before && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/alerts/history">Back to latest</Link>
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {before ? `Events before ${formatTimestamp(before)}` : "Most recent events"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {page.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No alert events recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatTimestamp(e.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(EVENT_BADGE_CLASSES[e.event_type])}>
                        {e.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.severity ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{e.rule_id}</TableCell>
                    <TableCell className="font-mono text-xs">{e.entity_id || "—"}</TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground" title={e.message ?? undefined}>
                      {e.message ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {hasOlder && oldest && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/alerts/history?before=${encodeURIComponent(oldest.created_at)}`}>Older events</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
