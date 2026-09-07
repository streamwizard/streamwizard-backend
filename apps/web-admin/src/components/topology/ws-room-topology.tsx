"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
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
import { ArrowLeft, Circle, Zap, ZapOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMonitor } from "@/components/ws-monitor-provider";
import type { MonitorEnvelope } from "@/lib/monitor-ws";
import { RoomNode } from "./nodes/room-node";
import { ConnectionNode } from "./nodes/connection-node";
import { AnimatedEdge } from "./edges/animated-edge";

const nodeTypes: NodeTypes = {
  roomNode: RoomNode,
  connectionNode: ConnectionNode,
};

const edgeTypes: EdgeTypes = {
  animatedEdge: AnimatedEdge,
};

const CENTER_X = 400;
const CENTER_Y = 300;
const RADIUS = 200;

function RoomTopologyInner({ roomId }: { roomId: string }) {
  const { fitView } = useReactFlow();
  const { snapshot, status, events } = useMonitor();
  const [animationEnabled, setAnimationEnabled] = useState(true);

  const room = snapshot?.rooms.find((r) => r.roomId === roomId) ?? null;

  const DOT_TRAVEL_MS = 600;
  type EdgeState = { trigger: number; isLast: boolean };
  const [activeEdges, setActiveEdges] = useState<Map<string, EdgeState>>(new Map());
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  // Identity-based cursor: events can share a millisecond, so a ts cursor
  // silently dropped same-ms pulses (see use-edge-animation.ts).
  const lastHeadRef = useRef<MonitorEnvelope | null>(null);

  const activateEdge = useCallback((edgeId: string, delay: number, isLast: boolean) => {
    const timer = setTimeout(() => {
      setActiveEdges((prev) => {
        const next = new Map(prev);
        const existing = next.get(edgeId);
        next.set(edgeId, { trigger: (existing?.trigger ?? 0) + 1, isLast });
        return next;
      });
      timersRef.current.delete(timer);
    }, delay);
    timersRef.current.add(timer);
  }, []);

  useEffect(() => {
    if (events.length === 0) return;

    const prevHead = lastHeadRef.current;
    lastHeadRef.current = events[0] ?? null;
    // Keep the cursor moving while animation is off so re-enabling doesn't
    // replay the buffered backlog.
    if (!animationEnabled || !room) return;

    const conns = room.connections ?? [];
    const subEdgeIds = conns
      .filter((c) => c.role === "subscriber")
      .map((c) => `e-room-conn-${c.connId}`);
    const hasSubscribers = subEdgeIds.length > 0;

    for (const evt of events) {
      if (evt === prevHead) break;
      if (evt.kind !== "message" || evt.roomId !== roomId) continue;

      if (evt.role === "publisher" || evt.role === "bot") {
        const pubConn = conns.find((c) => c.role === "publisher");
        if (pubConn) {
          activateEdge(`e-conn-${pubConn.connId}-room`, 0, !hasSubscribers);
        }
        for (const subEdgeId of subEdgeIds) {
          activateEdge(subEdgeId, pubConn ? DOT_TRAVEL_MS : 0, true);
        }
      }
    }
  }, [events, animationEnabled, room, roomId, activateEdge]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);

  const isAnimating = activeEdges.size > 0;

  const { layoutNodes, layoutEdges } = useMemo(() => {
    if (!room) return { layoutNodes: [] as Node[], layoutEdges: [] as Edge[] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    nodes.push({
      id: "room-center",
      type: "roomNode",
      position: { x: CENTER_X - 80, y: CENTER_Y - 40 },
      data: {
        roomId: room.roomId,
        hasPublisher: room.hasPublisher,
        subscriberCount: room.subscriberCount,
        streamId: room.streamId,
        isAnimating,
      },
    });

    const conns = room.connections ?? [];
    const publishers = conns.filter((c) => c.role === "publisher");
    const subscribers = conns.filter((c) => c.role === "subscriber");

    publishers.forEach((pub, i) => {
      const nodeId = `conn-${pub.connId}`;
      nodes.push({
        id: nodeId,
        type: "connectionNode",
        position: { x: CENTER_X - 280 - i * 30, y: CENTER_Y - 30 },
        data: {
          connId: pub.connId,
          role: pub.role,
          connectedAt: pub.connectedAt,
          channels: pub.channels,
        },
      });
      edges.push({
        id: `e-${nodeId}-room`,
        source: nodeId,
        target: "room-center",
        type: "animatedEdge",
        style: { stroke: "#60a5fa", strokeWidth: 2 },
        data: { dotColor: "#60a5fa" },
      });
    });

    const subCount = subscribers.length;
    subscribers.forEach((sub, i) => {
      const nodeId = `conn-${sub.connId}`;
      const startAngle = -Math.PI / 3;
      const endAngle = Math.PI / 3;
      const angle = subCount === 1
        ? 0
        : startAngle + (endAngle - startAngle) * (i / (subCount - 1));

      nodes.push({
        id: nodeId,
        type: "connectionNode",
        position: {
          x: CENTER_X + Math.cos(angle) * RADIUS,
          y: CENTER_Y + Math.sin(angle) * RADIUS - 30,
        },
        data: {
          connId: sub.connId,
          role: sub.role,
          connectedAt: sub.connectedAt,
          channels: sub.channels,
        },
      });
      edges.push({
        id: `e-room-${nodeId}`,
        source: "room-center",
        target: nodeId,
        type: "animatedEdge",
        style: { stroke: "#4ade80", strokeWidth: 1.5 },
        data: { dotColor: "#4ade80" },
      });
    });

    return { layoutNodes: nodes, layoutEdges: edges };
  }, [room, isAnimating]);

  const edgesWithAnimation = useMemo(() => {
    if (!animationEnabled) return layoutEdges;
    return layoutEdges.map((e) => {
      const state = activeEdges.get(e.id);
      if (state) {
        return { ...e, data: { ...e.data, isActive: true, trigger: state.trigger, isLast: state.isLast } };
      }
      return e;
    });
  }, [layoutEdges, activeEdges, animationEnabled]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(layoutNodes);
  const [edges, setEdges] = useEdgesState<Edge>(edgesWithAnimation);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(edgesWithAnimation);
  }, [layoutNodes, edgesWithAnimation, setNodes, setEdges]);

  useEffect(() => {
    if (layoutNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
    }
  }, [layoutNodes.length, fitView]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/ws/topology"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </Link>
          </div>
          <h1 className="text-xl font-semibold">
            Room <span className="font-mono text-base text-muted-foreground">{roomId}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            <Circle
              className={cn(
                "h-2 w-2 fill-current",
                status === "connected" ? "text-green-500" : status === "connecting" ? "text-yellow-500" : "text-red-500"
              )}
            />
            {status === "connected" ? "Live" : status === "connecting" ? "Connecting..." : "Disconnected"}
            {room && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <span>{room.subscriberCount} subscribers</span>
                <span className="text-muted-foreground/40">|</span>
                <span>Publisher {room.hasPublisher ? "online" : "offline"}</span>
              </>
            )}
          </p>
        </div>

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

      <div className="h-[600px] rounded-lg border border-border bg-background overflow-hidden">
        {!room ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {!snapshot
              ? status !== "connected"
                ? "Waiting for connection..."
                : "Waiting for snapshot..."
              : `Room "${roomId}" not found`}
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesConnectable={false}
            edgesReconnectable={false}
            fitView
            proOptions={{ hideAttribution: true }}
            minZoom={0.3}
            maxZoom={2}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={0.5} color="hsl(var(--muted-foreground) / 0.15)" />
            <Controls showInteractive={false} className="!border-border !bg-card !shadow-md [&>button]:!border-border [&>button]:!bg-card [&>button]:!text-foreground [&>button:hover]:!bg-accent" />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}

export function WsRoomTopology({ roomId }: { roomId: string }) {
  return (
    <ReactFlowProvider>
      <RoomTopologyInner roomId={roomId} />
    </ReactFlowProvider>
  );
}
