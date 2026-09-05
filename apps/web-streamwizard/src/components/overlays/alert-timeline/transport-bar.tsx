"use client";

import type { ReactNode } from "react";
import { findClip, MIN_CLIP_MS } from "@repo/alert-scene";
import { FlaskConical, Magnet, Maximize2, Pause, Play, Redo2, Repeat, Scissors, SkipBack, SkipForward, Undo2, Volume2, VolumeX, ZoomIn, ZoomOut } from "lucide-react";
import { Button, Kbd, KbdGroup, Separator, Tooltip, TooltipContent, TooltipTrigger, cn } from "@repo/ui";
import { AddLayerMenu } from "./add-layer-menu";
import { splitClipCommand } from "./commands";
import { formatTimecode } from "./format-time";
import { SampleSelect } from "./sample-select";
import { usePlayback, useTimeline, useTimelineStoreApi, useTimelineView } from "./timeline-context";
import type { TimelineState } from "./timeline-store";

/** The playhead sits inside the selected clip with room for a clip on either side. */
function canSplit(s: TimelineState): boolean {
  if (!s.selection.clipId) return false;
  const loc = findClip(s.scene, s.selection.clipId);
  if (!loc || loc.layer.locked) return false;
  return s.playhead - loc.clip.start >= MIN_CLIP_MS && loc.clip.end - s.playhead >= MIN_CLIP_MS;
}

function Tip({ label, keys, children }: { label: string; keys?: string[]; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-2">
        {label}
        {keys && (
          <KbdGroup>
            {keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </KbdGroup>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/** Buttons keep focus on the timeline so Space and arrows land there, not on the last clicked button. */
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

function TimeReadout() {
  const playhead = useTimeline((s) => s.playhead);
  const duration = useTimeline((s) => s.scene.duration);
  return (
    <span data-timeline-readout="" className="min-w-[9.5rem] text-center font-mono text-xs tabular-nums text-muted-foreground">
      <span className="text-foreground">{formatTimecode(playhead)}</span> / {formatTimecode(duration)}
    </span>
  );
}

export function TransportBar() {
  const api = useTimelineStoreApi();
  const { controls, playOnce } = usePlayback();
  const view = useTimelineView();
  const playing = useTimeline((s) => s.playing);
  const loop = useTimeline((s) => s.loop);
  const snap = useTimeline((s) => s.snap);
  const canUndo = useTimeline((s) => s.past.length > 0);
  const canRedo = useTimeline((s) => s.future.length > 0);
  const splittable = useTimeline(canSplit);
  const previewMuted = useTimeline((s) => s.previewMuted);

  const toggle = () => {
    controls.toggle();
    api.getState().setPlaying(controls.isPlaying());
  };

  const split = () => {
    const s = api.getState();
    if (!s.selection.clipId) return;
    const cmd = splitClipCommand(s.scene, s.selection.clipId, s.playhead);
    if (cmd) s.execute(cmd);
  };

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b bg-background px-2">
      <AddLayerMenu />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Tip label="Go to start" keys={["Home"]}>
        <Button size="icon-sm" variant="ghost" aria-label="Go to start" onMouseDown={keepFocus} onClick={() => api.getState().setPlayhead(0)}>
          <SkipBack />
        </Button>
      </Tip>
      <Tip label={playing ? "Pause" : "Play"} keys={["Space"]}>
        <Button size="icon-sm" variant={playing ? "secondary" : "ghost"} aria-label={playing ? "Pause" : "Play"} aria-pressed={playing} onMouseDown={keepFocus} onClick={toggle}>
          {playing ? <Pause /> : <Play />}
        </Button>
      </Tip>
      <Tip label="Go to end" keys={["End"]}>
        <Button size="icon-sm" variant="ghost" aria-label="Go to end" onMouseDown={keepFocus} onClick={() => api.getState().setPlayhead(api.getState().scene.duration)}>
          <SkipForward />
        </Button>
      </Tip>
      <Tip label={loop ? "Loop on" : "Loop off"} keys={["L"]}>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Loop"
          aria-pressed={loop}
          onMouseDown={keepFocus}
          onClick={() => api.getState().setLoop(!loop)}
          className={cn(loop && "bg-accent text-accent-foreground")}
        >
          <Repeat />
        </Button>
      </Tip>
      <Tip label={previewMuted ? "Unmute preview" : "Mute preview"}>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={previewMuted ? "Unmute preview" : "Mute preview"}
          aria-pressed={previewMuted}
          onMouseDown={keepFocus}
          onClick={() => api.getState().setPreviewMuted(!previewMuted)}
          className={cn(previewMuted && "bg-accent text-accent-foreground")}
        >
          {previewMuted ? <VolumeX /> : <Volume2 />}
        </Button>
      </Tip>
      <TimeReadout />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Tip label="Play once with the sample" keys={["T"]}>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" aria-label="Test: play once with the sample" onMouseDown={keepFocus} onClick={playOnce}>
          <FlaskConical className="size-3.5" />
          Test
        </Button>
      </Tip>
      <SampleSelect />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Tip label="Split at playhead" keys={["S"]}>
        <Button size="icon-sm" variant="ghost" aria-label="Split at playhead" disabled={!splittable} onMouseDown={keepFocus} onClick={split}>
          <Scissors />
        </Button>
      </Tip>
      <Tip label="Undo" keys={["Ctrl", "Z"]}>
        <Button size="icon-sm" variant="ghost" aria-label="Undo" disabled={!canUndo} onMouseDown={keepFocus} onClick={() => api.getState().undo()}>
          <Undo2 />
        </Button>
      </Tip>
      <Tip label="Redo" keys={["Ctrl", "Shift", "Z"]}>
        <Button size="icon-sm" variant="ghost" aria-label="Redo" disabled={!canRedo} onMouseDown={keepFocus} onClick={() => api.getState().redo()}>
          <Redo2 />
        </Button>
      </Tip>
      <div className="flex-1" />
      <Tip label={snap ? "Snapping on. Hold Alt to drag free." : "Snapping off. Hold Alt to snap."}>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Snap"
          aria-pressed={snap}
          onMouseDown={keepFocus}
          onClick={() => api.getState().setSnap(!snap)}
          className={cn(snap && "bg-accent text-accent-foreground")}
        >
          <Magnet />
        </Button>
      </Tip>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Tip label="Zoom out" keys={["-"]}>
        <Button size="icon-sm" variant="ghost" aria-label="Zoom out" onMouseDown={keepFocus} onClick={() => view.zoomBy(0.8)}>
          <ZoomOut />
        </Button>
      </Tip>
      <Tip label="Zoom in" keys={["+"]}>
        <Button size="icon-sm" variant="ghost" aria-label="Zoom in" onMouseDown={keepFocus} onClick={() => view.zoomBy(1.25)}>
          <ZoomIn />
        </Button>
      </Tip>
      <Tip label="Fit timeline" keys={["Shift", "0"]}>
        <Button size="icon-sm" variant="ghost" aria-label="Fit timeline" onMouseDown={keepFocus} onClick={() => view.fit()}>
          <Maximize2 />
        </Button>
      </Tip>
    </div>
  );
}
