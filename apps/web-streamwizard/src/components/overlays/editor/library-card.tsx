"use client";

import { Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui";
import { Download, Loader2 } from "lucide-react";
import { buildWidgetSrcdoc, mergeFieldValues } from "@repo/ui/overlay";
import type { WidgetFieldSchema } from "@repo/ui/overlay";

export interface LibraryEntry {
  id: string;
  title: string;
  description: string;
  tags: string[];
  installs: number;
  overlay_widgets: {
    html: string;
    js: string;
    extra_css: string;
    fields: WidgetFieldSchema;
  };
}

export function LibraryCard({
  entry,
  onInstall,
  isInstalling,
}: {
  entry: LibraryEntry;
  onInstall: () => void;
  isInstalling: boolean;
}) {
  const srcdoc = buildWidgetSrcdoc(
    entry.overlay_widgets.html,
    entry.overlay_widgets.js,
    entry.overlay_widgets.extra_css,
    entry.overlay_widgets.fields,
    mergeFieldValues(entry.overlay_widgets.fields, {})
  );

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-md transition-all duration-200">
      {/* Live preview */}
      <div className="relative h-40 bg-black shrink-0 overflow-hidden">
        <iframe
          srcDoc={srcdoc}
          sandbox="allow-scripts"
          className="absolute inset-0 w-full h-full border-0"
          style={{ pointerEvents: "none", background: "transparent", colorScheme: "normal" }}
          title={entry.title}
        />
        {/* installs badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] text-white/70">
          <Download className="h-2.5 w-2.5" />
          {entry.installs}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 px-4 pt-3 pb-4 gap-3">
        <div>
          <p className="font-semibold text-sm leading-snug truncate">{entry.title}</p>
          {entry.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{entry.description}</p>
          )}
          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entry.tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Button size="sm" className="mt-auto w-full text-xs" onClick={onInstall} disabled={isInstalling}>
          {isInstalling ? "Installing…" : "Install"}
        </Button>
      </div>
    </div>
  );
}
