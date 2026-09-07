"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot, Radio, Repeat, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeSource, type SourceKind } from "../source-label";
import { formatElapsed } from "@/lib/format";

// One node per producer `source` label (a source can briefly hold >1 socket
// during a reconnect — shown as a connection count).
export type BotNodeData = {
  source: string;
  connCount: number;
  connectedAt: number;
};

const KIND_ICONS: Record<SourceKind, typeof Bot> = {
  "ingest-node": Radio,
  "overlay-bot": Bot,
  "auto-switcher": Repeat,
  unknown: HelpCircle,
};

export const BotNode = memo(function BotNode({ data }: NodeProps) {
  const { source, connCount, connectedAt } = data as BotNodeData;
  const label = describeSource(source);
  const Icon = KIND_ICONS[label.kind];
  // The auto-switcher shows up twice (it also holds a consumer socket) —
  // spell out which half this is.
  const roleTag = label.kind === "auto-switcher" ? "status out" : "producer";

  return (
    <div className="rounded-lg border border-purple-500/40 bg-purple-950/40 px-4 py-3 shadow-md min-w-[150px]">
      <Handle type="source" position={Position.Bottom} className="!bg-purple-400 !w-2 !h-2" />

      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-purple-400" />
        <span className="text-sm font-semibold text-purple-200">{label.title}</span>
        {connCount > 1 && (
          <span className="text-[10px] rounded bg-purple-500/20 px-1 text-purple-300">×{connCount}</span>
        )}
      </div>

      <div className="text-[10px] font-medium uppercase tracking-wider text-purple-400/80 mb-0.5">{roleTag}</div>

      {label.subtitle && (
        <div className={cn("text-xs text-purple-300/80 font-mono truncate max-w-[180px]")}>{label.subtitle}</div>
      )}

      <div className="text-[10px] text-muted-foreground mt-0.5">{formatElapsed(Date.now() - connectedAt)}</div>
    </div>
  );
});
