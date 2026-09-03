"use client";

import { TimelinePanel } from "./timeline/timeline-panel";
import { TransportBar } from "./transport-bar";

export function TimelineSection() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TransportBar />
      <div className="min-h-0 flex-1">
        <TimelinePanel />
      </div>
    </div>
  );
}
