"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@repo/ui";
import { useVideoPlayerStore } from "@/stores/video-dialog-store";

interface ZoomControlsProps {
  clipCenterPoint?: number;
  currentTime: number;
}

/**
 * Zoom controls for the timeline
 */
export function ZoomControls({ clipCenterPoint, currentTime }: ZoomControlsProps) {
  const zoomLevel = useVideoPlayerStore((s) => s.zoomLevel);
  const zoomIn = useVideoPlayerStore((s) => s.zoomIn);
  const zoomOut = useVideoPlayerStore((s) => s.zoomOut);

  const centerPoint = clipCenterPoint ?? currentTime;

  return (
    <div className="flex items-center justify-end gap-2 mb-2">
      <span className="hidden text-xs text-muted-foreground sm:inline">Shift + scroll to zoom</span>
      <span className="text-xs text-muted-foreground">Zoom: {zoomLevel.toFixed(1)}x</span>
      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => zoomOut(centerPoint)} disabled={zoomLevel <= 1}>
        <ZoomOut className="h-3 w-3" />
      </Button>
      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => zoomIn(centerPoint)} disabled={zoomLevel >= 20}>
        <ZoomIn className="h-3 w-3" />
      </Button>
    </div>
  );
}
