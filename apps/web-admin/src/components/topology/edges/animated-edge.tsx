"use client";

import { useEffect, useRef, useState } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

const DOT_LIFETIME_MS = 650;
let globalDotId = 0;

type AnimatedEdgeData = {
  isLast?: boolean;
  dotColor?: string;
  trigger?: number;
};

type Dot = {
  id: number;
  isLast: boolean;
};

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: EdgeProps) {
  const { isLast = true, dotColor = "#60a5fa", trigger = 0 } = (data ?? {}) as AnimatedEdgeData;

  const [dots, setDots] = useState<Dot[]>([]);
  const lastTriggerRef = useRef(0);
  // Every dot gets its own removal timer. A shared "remove the latest" timer
  // cancelled earlier dots' cleanup whenever pulses overlapped, leaving them
  // frozen at the end of the edge (animateMotion fill="freeze").
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    if (trigger === 0 || trigger === lastTriggerRef.current) return;
    lastTriggerRef.current = trigger;

    const dotId = ++globalDotId;
    setDots((prev) => [...prev, { id: dotId, isLast }]);
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      setDots((prev) => prev.filter((d) => d.id !== dotId));
    }, DOT_LIFETIME_MS);
    timersRef.current.add(timer);
  }, [trigger, isLast]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      {dots.map((dot) => (
        <g key={dot.id}>
          <circle r="4" fill={dotColor} opacity="0.7">
            <animateMotion dur="0.6s" repeatCount="1" path={edgePath} fill="freeze" />
            {dot.isLast && (
              <animate attributeName="opacity" values="0.7;0.7;0" keyTimes="0;0.7;1" dur="0.6s" fill="freeze" />
            )}
          </circle>
          <circle r="2" fill="white" opacity="0.9">
            <animateMotion dur="0.6s" repeatCount="1" path={edgePath} fill="freeze" />
            {dot.isLast && (
              <animate attributeName="opacity" values="0.9;0.9;0" keyTimes="0;0.7;1" dur="0.6s" fill="freeze" />
            )}
          </circle>
        </g>
      ))}
    </>
  );
}
