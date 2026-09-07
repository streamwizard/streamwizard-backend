"use client";

import { useMemo } from "react";
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { BotConnSnapshot, ConsumerConnSnapshot, MonitorSnapshot } from "@/lib/monitor-ws";

const SERVER_NODE_ID = "server";
const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const CONN_NODE_WIDTH = 120;
const CONN_NODE_HEIGHT = 60;

interface LayoutOptions {
  expanded: boolean;
}

/** Edge id a bot's traffic animates on — shared with use-edge-animation. */
export function botEdgeId(source: string): string {
  return `e-bot-${source}`;
}

// One topology node per distinct `source` label. A label normally maps to a
// single socket, but reconnects can briefly overlap — collapse those into a
// count instead of drawing twins.
function groupBySource<T extends { source: string; connectedAt: number }>(conns: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const conn of conns) {
    const group = groups.get(conn.source) ?? [];
    group.push(conn);
    groups.set(conn.source, group);
  }
  return groups;
}

export function useTopologyLayout(
  snapshot: MonitorSnapshot | null,
  options: LayoutOptions
) {
  return useMemo(() => {
    if (!snapshot) return { nodes: [] as Node[], edges: [] as Edge[] };

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 60 });

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    g.setNode(SERVER_NODE_ID, { width: NODE_WIDTH, height: NODE_HEIGHT });
    nodes.push({
      id: SERVER_NODE_ID,
      type: "serverNode",
      position: { x: 0, y: 0 },
      data: {
        totalConnections: snapshot.totalConnections,
        roomCount: snapshot.rooms.length,
      },
    });

    // Producers (bots): overlay bot, one per ingest node, auto-switcher
    // status publisher — labeled by their self-declared source.
    for (const [source, conns] of groupBySource<BotConnSnapshot>(snapshot.bots)) {
      const botNodeId = `bot-${source}`;
      g.setNode(botNodeId, { width: NODE_WIDTH, height: NODE_HEIGHT });
      nodes.push({
        id: botNodeId,
        type: "botNode",
        position: { x: 0, y: 0 },
        data: {
          source,
          connCount: conns.length,
          connectedAt: Math.min(...conns.map((c) => c.connectedAt)),
        },
      });
      edges.push({
        id: botEdgeId(source),
        source: botNodeId,
        target: SERVER_NODE_ID,
        type: "animatedEdge",
        style: { stroke: "#a855f7", strokeWidth: 1.5 },
        data: { dotColor: "#a855f7" },
      });
      g.setEdge(botNodeId, SERVER_NODE_ID);
    }

    // Server-side consumers (obs-auto-switcher): receive the cross-room feed,
    // so the edge points away from the server. `types` rides on the edge so
    // the animation hook can light it up only for messages it would deliver.
    for (const [source, conns] of groupBySource<ConsumerConnSnapshot>(snapshot.consumers ?? [])) {
      const consumerNodeId = `consumer-${source}`;
      const types = conns[0]?.types ?? [];
      g.setNode(consumerNodeId, { width: NODE_WIDTH, height: NODE_HEIGHT });
      nodes.push({
        id: consumerNodeId,
        type: "consumerNode",
        position: { x: 0, y: 0 },
        data: {
          source,
          connCount: conns.length,
          connectedAt: Math.min(...conns.map((c) => c.connectedAt)),
          types,
        },
      });
      edges.push({
        id: `e-server-consumer-${source}`,
        source: SERVER_NODE_ID,
        target: consumerNodeId,
        type: "animatedEdge",
        style: { stroke: "#fb923c", strokeWidth: 1.5 },
        data: { dotColor: "#fb923c", consumerTypes: types },
      });
      g.setEdge(SERVER_NODE_ID, consumerNodeId);
    }

    for (const room of snapshot.rooms) {
      const roomNodeId = `room-${room.roomId}`;

      g.setNode(roomNodeId, { width: NODE_WIDTH, height: NODE_HEIGHT });
      nodes.push({
        id: roomNodeId,
        type: "roomNode",
        position: { x: 0, y: 0 },
        data: {
          roomId: room.roomId,
          hasPublisher: room.hasPublisher,
          subscriberCount: room.subscriberCount,
          streamId: room.streamId,
          isAnimating: false,
        },
      });

      edges.push({
        id: `e-server-${roomNodeId}`,
        source: SERVER_NODE_ID,
        target: roomNodeId,
        type: "animatedEdge",
        style: { stroke: "#a1a1aa", strokeWidth: 1.5 },
        data: { dotColor: "#4ade80" },
      });

      if (options.expanded && room.connections) {
        for (const conn of room.connections) {
          const connNodeId = `conn-${room.roomId}-${conn.connId}`;

          g.setNode(connNodeId, { width: CONN_NODE_WIDTH, height: CONN_NODE_HEIGHT });
          nodes.push({
            id: connNodeId,
            type: "connectionNode",
            position: { x: 0, y: 0 },
            data: {
              connId: conn.connId,
              role: conn.role,
              connectedAt: conn.connectedAt,
              channels: conn.channels,
            },
          });

          const connColor = conn.role === "publisher" ? "#60a5fa" : "#4ade80";
          edges.push({
            id: `e-${roomNodeId}-${connNodeId}`,
            source: roomNodeId,
            target: connNodeId,
            type: "animatedEdge",
            style: { stroke: connColor, strokeWidth: 1.5 },
            data: { dotColor: connColor },
          });

          g.setEdge(roomNodeId, connNodeId);
        }
      }

      g.setEdge(SERVER_NODE_ID, roomNodeId);
    }

    dagre.layout(g);

    for (const node of nodes) {
      const nodeInfo = g.node(node.id);
      if (nodeInfo) {
        node.position = { x: nodeInfo.x - nodeInfo.width / 2, y: nodeInfo.y - nodeInfo.height / 2 };
      }
    }

    return { nodes, edges };
  }, [snapshot, options.expanded]);
}
