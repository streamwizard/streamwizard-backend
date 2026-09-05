"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { samplesForEvent } from "./sample-payloads";
import { usePlayback, useTimeline, useTimelineStoreApi } from "./timeline-context";

/**
 * Which sample alert the preview renders. Session state: switching it changes
 * the tokens on the stage and what Test plays, never the scene.
 */
export function SampleSelect() {
  const api = useTimelineStoreApi();
  const { paneRef } = usePlayback();
  const event = useTimeline((s) => s.event);
  const sampleId = useTimeline((s) => s.sampleId);
  const samples = samplesForEvent(event);

  return (
    <div className="flex items-center gap-1.5" data-sample-select="">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sample</span>
      <Select value={sampleId} onValueChange={(v) => api.getState().setSample(v)}>
        <SelectTrigger size="sm" className="h-7 max-w-[14rem] gap-1 px-2 text-xs" aria-label="Sample alert">
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          // Focus goes back to the timeline so Space plays instead of reopening the list.
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            paneRef.current?.focus({ preventScroll: true });
          }}
        >
          {samples.map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
