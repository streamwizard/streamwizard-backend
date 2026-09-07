"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { formatElapsed } from "@/lib/format";

export type ConnectionNodeData = {
  connId: string;
  role: "publisher" | "subscriber";
  connectedAt: number;
  channels: string[];
};

export const ConnectionNode = memo(function ConnectionNode({ data }: NodeProps) {
  const { connId, role, connectedAt, channels } = data as ConnectionNodeData;
  const isPub = role === "publisher";
  const duration = formatElapsed(Date.now() - connectedAt);

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 shadow-sm min-w-[100px]",
        isPub
          ? "border-blue-500/30 bg-blue-950/40"
          : "border-green-500/30 bg-green-950/40"
      )}
    >
      <Handle type="target" position={Position.Top} className={cn("!w-2 !h-2", isPub ? "!bg-blue-400" : "!bg-green-400")} />

      <div className="flex items-center gap-2 mb-0.5">
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-wider",
            isPub ? "text-blue-400" : "text-green-400"
          )}
        >
          {role}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">{connId}</span>
      </div>

      <div className="text-[10px] text-muted-foreground">{duration}</div>

      {channels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {channels.slice(0, 3).map((ch) => (
            <span key={ch} className="text-[9px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
              {ch}
            </span>
          ))}
          {channels.length > 3 && (
            <span className="text-[9px] text-muted-foreground">+{channels.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
});
