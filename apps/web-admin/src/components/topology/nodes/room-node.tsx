"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Radio, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type RoomNodeData = {
  roomId: string;
  hasPublisher: boolean;
  subscriberCount: number;
  streamId: string | null;
  isAnimating: boolean;
};

export const RoomNode = memo(function RoomNode({ data }: NodeProps) {
  const { roomId, hasPublisher, subscriberCount, streamId, isAnimating } = data as RoomNodeData;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-4 py-3 shadow-md min-w-[160px] transition-shadow duration-300",
        hasPublisher ? "border-green-500/40" : "border-border",
        isAnimating && "shadow-green-500/30 shadow-lg"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2" />

      <div className="font-mono text-xs text-muted-foreground mb-1.5">{roomId}</div>

      <div className="flex items-center gap-3 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1",
            hasPublisher ? "text-green-400" : "text-muted-foreground"
          )}
        >
          <Radio className="h-3 w-3" />
          {hasPublisher ? "Live" : "No Publisher"}
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Users className="h-3 w-3" />
          {subscriberCount}
        </span>
      </div>

      {streamId && (
        <div className="text-[10px] text-muted-foreground/60 mt-1 font-mono truncate max-w-[140px]">
          {streamId}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-2 !h-2" />
    </div>
  );
});
