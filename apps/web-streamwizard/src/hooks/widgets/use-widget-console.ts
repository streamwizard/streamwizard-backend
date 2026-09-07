"use client";

import { useState } from "react";
import type { WidgetLogEntry } from "@repo/ui/overlay";

/** Ring-buffer bound so a runaway logging loop can't grow the page unbounded. */
const MAX_LOGS = 300;

/** Console output forwarded out of the preview iframe. Errors open the panel. */
export function useWidgetConsole() {
  const [logs, setLogs] = useState<WidgetLogEntry[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);

  function appendLog(entry: WidgetLogEntry) {
    setLogs((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
    });
    if (entry.level === "error") setConsoleOpen(true);
  }

  return { logs, setLogs, consoleOpen, setConsoleOpen, appendLog };
}
