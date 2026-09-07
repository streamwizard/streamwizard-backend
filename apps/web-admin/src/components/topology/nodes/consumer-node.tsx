"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot, Radio, Repeat, HelpCircle } from "lucide-react";
import { describeSource, type SourceKind } from "../source-label";
import { formatElapsed } from "@/lib/format";

// Trusted server-side consumers (obs-auto-switcher): they RECEIVE the
// cross-room feed, so they hang below the server with the edge pointing at
// them — the mirror image of a bot/producer.
export type ConsumerNodeData = {
  source: string;
  connCount: number;
  connectedAt: number;
  /** Message-type filter (empty = everything). */
  types: string[];
};

const KIND_ICONS: Record<SourceKind, typeof Bot> = {
  "ingest-node": Radio,
  "overlay-bot": Bot,
  "auto-switcher": Repeat,
  unknown: HelpCircle,
};

export const ConsumerNode = memo(function ConsumerNode({ data }: NodeProps) {
  const { source, connCount, connectedAt, types } = data as ConsumerNodeData;
  const label = describeSource(source);
  const Icon = KIND_ICONS[label.kind];

  return (
    <div className="rounded-lg border border-orange-500/40 bg-orange-950/30 px-4 py-3 shadow-md min-w-[150px]">
      <Handle type="target" position={Position.Top} className="!bg-orange-400 !w-2 !h-2" />

      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-orange-400" />
        <span className="text-sm font-semibold text-orange-200">{label.title}</span>
        {connCount > 1 && (
          <span className="text-[10px] rounded bg-orange-500/20 px-1 text-orange-300">×{connCount}</span>
        )}
      </div>

      <div className="text-[10px] font-medium uppercase tracking-wider text-orange-400/80 mb-0.5">
        {label.kind === "auto-switcher" ? "stats feed in" : "consumer"}
      </div>

      {label.subtitle && <div className="text-xs text-orange-300/80 font-mono truncate max-w-[180px]">{label.subtitle}</div>}

      {types.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 max-w-[200px]">
          {types.slice(0, 3).map((t) => (
            <span key={t} className="text-[9px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
              {t.replace("streamwizard.", "")}
            </span>
          ))}
          {types.length > 3 && <span className="text-[9px] text-muted-foreground">+{types.length - 3}</span>}
        </div>
      )}

      <div className="text-[10px] text-muted-foreground mt-0.5">{formatElapsed(Date.now() - connectedAt)}</div>
    </div>
  );
});
