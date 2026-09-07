"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Server } from "lucide-react";

export type ServerNodeData = {
  totalConnections: number;
  roomCount: number;
};

export const ServerNode = memo(function ServerNode({ data }: NodeProps) {
  const { totalConnections, roomCount } = data as ServerNodeData;

  return (
    <div className="rounded-xl border-2 border-blue-500/40 bg-blue-950/60 px-5 py-3 shadow-lg shadow-blue-500/10 min-w-[180px]">
      <div className="flex items-center gap-2 mb-2">
        <Server className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-semibold text-blue-200">WS Server</span>
      </div>
      <div className="flex gap-4 text-xs text-blue-300/80">
        <span>{totalConnections} conn</span>
        <span>{roomCount} rooms</span>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-2 !h-2" />
    </div>
  );
});
