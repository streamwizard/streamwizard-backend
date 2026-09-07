"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Circle, Expand, Shrink, Zap, ZapOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMonitor } from "@/components/ws-monitor-provider";
import { useTopologyLayout } from "@/hooks/topology/use-topology-layout";
import { useEdgeAnimation } from "@/hooks/topology/use-edge-animation";
import { ServerNode } from "./nodes/server-node";
import { RoomNode } from "./nodes/room-node";
import { ConnectionNode } from "./nodes/connection-node";
import { BotNode } from "./nodes/bot-node";
import { ConsumerNode } from "./nodes/consumer-node";
import { AnimatedEdge } from "./edges/animated-edge";
import { useEffect } from "react";

const nodeTypes: NodeTypes = {
  serverNode: ServerNode,
  roomNode: RoomNode,
  connectionNode: ConnectionNode,
  botNode: BotNode,
  consumerNode: ConsumerNode,
};

const edgeTypes: EdgeTypes = {
  animatedEdge: AnimatedEdge,
};

function TopologyInner() {
  const router = useRouter();
  const { fitView } = useReactFlow();
  const { snapshot, status, events } = useMonitor();

  const [expanded, setExpanded] = useState(false);
  const [animationEnabled, setAnimationEnabled] = useState(true);

  const { nodes: layoutNodes, edges: layoutEdges } = useTopologyLayout(snapshot, { expanded });
  const activeEdges = useEdgeAnimation(events, animationEnabled, layoutEdges);

  const nodesWithAnimation = useMemo(() => {
    return layoutNodes.map((node) => {
      if (node.type === "roomNode") {
        const roomId = (node.data as { roomId: string }).roomId;
        const edgeId = `e-server-room-${roomId}`;
        return {
          ...node,
          data: { ...node.data, isAnimating: activeEdges.has(edgeId) },
        };
      }
      return node;
    });
  }, [layoutNodes, activeEdges]);

  const edgesWithAnimation = useMemo(() => {
    if (!animationEnabled) return layoutEdges;
    return layoutEdges.map((edge) => {
      const state = activeEdges.get(edge.id);
      if (state) {
        return { ...edge, data: { ...edge.data, isActive: true, trigger: state.trigger, isLast: state.isLast } };
      }
      return edge;
    });
  }, [layoutEdges, activeEdges, animationEnabled]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(nodesWithAnimation);
  const [edges, setEdges] = useEdgesState<Edge>(edgesWithAnimation);

  useEffect(() => {
    setNodes(nodesWithAnimation);
    setEdges(edgesWithAnimation);
  }, [nodesWithAnimation, edgesWithAnimation, setNodes, setEdges]);

  useEffect(() => {
    if (layoutNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
    }
  }, [layoutNodes.length, expanded, fitView]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "roomNode") {
        const roomId = (node.data as { roomId: string }).roomId;
        router.push(`/ws/topology/${encodeURIComponent(roomId)}`);
      }
    },
    [router]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">WS Topology</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            <Circle
              className={cn(
                "h-2 w-2 fill-current",
                status === "connected" ? "text-green-500" : status === "connecting" ? "text-yellow-500" : "text-red-500"
              )}
            />
            {status === "connected" ? "Live" : status === "connecting" ? "Connecting..." : "Disconnected"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
              expanded
                ? "bg-accent text-accent-foreground border-border"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground border-transparent"
            )}
          >
            {expanded ? <Shrink className="h-3 w-3" /> : <Expand className="h-3 w-3" />}
            {expanded ? "Collapse" : "Expand"}
          </button>
          <button
            onClick={() => setAnimationEnabled((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
              animationEnabled
                ? "bg-accent text-accent-foreground border-border"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground border-transparent"
            )}
          >
            {animationEnabled ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
            {animationEnabled ? "Animated" : "Static"}
          </button>
        </div>
      </div>

      <div className="h-[600px] rounded-lg border border-border bg-background overflow-hidden">
        {!snapshot ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {status !== "connected" ? "Waiting for connection..." : "Waiting for snapshot..."}
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesConnectable={false}
            edgesReconnectable={false}
            fitView
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
            maxZoom={2}
            className="topology-flow"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={0.5} color="hsl(var(--muted-foreground) / 0.15)" />
            <Controls showInteractive={false} className="!border-border !bg-card !shadow-md [&>button]:!border-border [&>button]:!bg-card [&>button]:!text-foreground [&>button:hover]:!bg-accent" />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === "serverNode") return "#60a5fa";
                if (node.type === "roomNode") return "#4ade80";
                if (node.type === "botNode") return "#a855f7";
                if (node.type === "consumerNode") return "#fb923c";
                return "#a1a1aa";
              }}
              className="!bg-card !border-border"
              maskColor="hsl(var(--background) / 0.7)"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}

export function WsTopology() {
  return (
    <ReactFlowProvider>
      <TopologyInner />
    </ReactFlowProvider>
  );
}
