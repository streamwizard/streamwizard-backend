"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { WidgetLogEntry } from "@repo/ui/overlay";
import { Button } from "@repo/ui";

const LEVEL_CLASS: Record<WidgetLogEntry["level"], string> = {
  log: "text-zinc-300",
  info: "text-sky-300",
  warn: "text-amber-300",
  error: "text-red-400",
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
}

/**
 * Widget code runs in a `sandbox="allow-scripts"` iframe, so its console output
 * and uncaught errors are invisible in the parent's devtools. This surfaces
 * them; without it authors debug blind.
 */
export function WidgetConsolePanel({
  logs,
  open,
  onToggle,
  onClear,
}: {
  logs: WidgetLogEntry[];
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const errorCount = logs.filter((l) => l.level === "error").length;

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, open]);

  return (
    <div className="shrink-0 border-t bg-background">
      <div className="px-3 py-1 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Console
          {logs.length > 0 && (
            <span className="text-[10px] text-muted-foreground">({logs.length})</span>
          )}
        </button>

        {errorCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
            {errorCount} error{errorCount === 1 ? "" : "s"}
          </span>
        )}

        {open && logs.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs ml-auto"
            onClick={onClear}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {open && (
        <div
          ref={scrollRef}
          className="h-40 overflow-y-auto border-t bg-zinc-950 px-3 py-1.5 font-mono text-[11px] leading-relaxed"
        >
          {logs.length === 0 ? (
            <p className="text-zinc-500">
              Nothing logged yet. console.log from your widget shows up here.
            </p>
          ) : (
            logs.map((entry, i) => (
              <div key={`${entry.ts}-${i}`} className="flex gap-2">
                <span className="text-zinc-600 shrink-0">{formatTime(entry.ts)}</span>
                <span className={`${LEVEL_CLASS[entry.level]} whitespace-pre-wrap break-all`}>
                  {entry.text}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
