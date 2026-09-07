"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveLibraryEntry, rejectLibraryEntry } from "@/actions/widget-library";
import { buildWidgetSrcdoc, mergeFieldValues } from "@repo/ui/overlay";
import type { WidgetFieldSchema } from "@repo/ui/overlay";
import { Button } from "@repo/ui";
import { Badge } from "@repo/ui";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui";

interface PendingEntry {
  id: string;
  title: string;
  description: string;
  tags: string[];
  created_at: string;
  overlay_widgets: {
    html: string;
    js: string;
    extra_css: string;
    fields: WidgetFieldSchema;
  };
}

export function AdminWidgetLibraryClient({
  entries,
  error,
}: {
  entries: PendingEntry[];
  error: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);

  function handleApprove(id: string) {
    setActionId(id);
    startTransition(async () => {
      await approveLibraryEntry(id);
      setActionId(null);
      router.refresh();
    });
  }

  function handleReject(id: string) {
    setActionId(id);
    startTransition(async () => {
      await rejectLibraryEntry(id);
      setActionId(null);
      router.refresh();
    });
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        No pending submissions.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {entries.map((entry) => {
        const srcdoc = buildWidgetSrcdoc(
          entry.overlay_widgets.html,
          entry.overlay_widgets.js,
          entry.overlay_widgets.extra_css,
          entry.overlay_widgets.fields,
          mergeFieldValues(entry.overlay_widgets.fields, {})
        );
        return (
          <Card key={entry.id} className="overflow-hidden">
            <div className="bg-black h-48 relative">
              <iframe
                srcDoc={srcdoc}
                sandbox="allow-scripts"
                className="absolute inset-0 w-full h-full border-0"
                title={entry.title}
              />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{entry.title}</CardTitle>
            </CardHeader>
            {(entry.description || entry.tags.length > 0) && (
              <CardContent className="pb-2 space-y-2">
                {entry.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {entry.description}
                  </p>
                )}
                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Submitted {new Date(entry.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            )}
            <CardFooter className="gap-2">
              <Button
                size="sm"
                onClick={() => handleApprove(entry.id)}
                disabled={isPending && actionId === entry.id}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleReject(entry.id)}
                disabled={isPending && actionId === entry.id}
              >
                Reject
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
