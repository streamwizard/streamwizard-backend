"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Edge } from "@xyflow/react";
import type { MonitorEnvelope } from "@/lib/monitor-ws";

const DOT_TRAVEL_MS = 600;

export type EdgeAnimationState = { trigger: number; isLast: boolean };
export type ActiveEdges = Map<string, EdgeAnimationState>;

export function useEdgeAnimation(
  events: MonitorEnvelope[],
  enabled: boolean,
  layoutEdges: Edge[] = []
) {
  const [activeEdges, setActiveEdges] = useState<ActiveEdges>(new Map());
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  // "What's new since last run" cursor by object identity, not timestamp:
  // the buffer is prepended immutably, and several events can share one
  // millisecond (many bots reporting at once) — a ts cursor dropped those.
  const lastHeadRef = useRef<MonitorEnvelope | null>(null);
  const layoutEdgesRef = useRef(layoutEdges);

  useEffect(() => {
    layoutEdgesRef.current = layoutEdges;
  }, [layoutEdges]);

  const emitDot = useCallback((edgeId: string, delay: number, isLast: boolean) => {
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
    // Advance the cursor even while animation is off, so re-enabling doesn't
    // replay the entire buffered backlog in one burst.
    if (!enabled) return;

    // Only pulse edges that exist in the current layout — bot messages for
    // rooms nobody watches (delivered:false) have no edge, and phantom ids
    // would otherwise pile up in the activeEdges map forever.
    const edgeIds = new Set(layoutEdgesRef.current.map((e) => e.id));
    const emit = (edgeId: string, delay: number, isLast: boolean) => {
      if (edgeIds.has(edgeId)) emitDot(edgeId, delay, isLast);
    };

    for (const evt of events) {
      if (evt === prevHead) break;
      if (evt.kind !== "message") continue;

      const roomNodeId = `room-${evt.roomId}`;
      const roomEdgeId = `e-server-${roomNodeId}`;

      const connEdges = layoutEdgesRef.current.filter(
        (e) => e.source === roomNodeId && e.id !== roomEdgeId
      );
      const hasConnEdges = connEdges.length > 0;

      if (evt.role === "bot") {
        // Light up the edge of the specific bot that sent this (keyed by its
        // source label), plus every consumer edge whose type filter would
        // deliver the message.
        emit(`e-bot-${evt.source ?? "unknown"}`, 0, false);
        for (const edge of layoutEdgesRef.current) {
          if (!edge.id.startsWith("e-server-consumer-")) continue;
          const types = (edge.data as { consumerTypes?: string[] } | undefined)?.consumerTypes ?? [];
          if (types.length === 0 || (evt.eventType && types.includes(evt.eventType))) {
            emit(edge.id, DOT_TRAVEL_MS, true);
          }
        }
        emit(roomEdgeId, DOT_TRAVEL_MS, !hasConnEdges);
        for (const ce of connEdges) {
          emit(ce.id, DOT_TRAVEL_MS * 2, true);
        }
      } else if (evt.role === "publisher") {
        emit(roomEdgeId, 0, !hasConnEdges);
        for (const ce of connEdges) {
          emit(ce.id, DOT_TRAVEL_MS, true);
        }
      }
    }
  }, [events, enabled, emitDot]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, []);

  return activeEdges;
}
