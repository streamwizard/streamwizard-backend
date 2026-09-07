"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@repo/ui";
import { Monitor, Smartphone } from "lucide-react";
import { NumberField } from "./number-field";
import {
  describeResolutionChange,
  type ResolutionChangeMode,
  type SceneSize,
} from "./scene-resize";

/**
 * The sizes streamers actually use, so most changes are one click. Vertical is
 * the same ladder turned on its side, for phone-shaped overlays.
 */
const PRESET_ROWS = [
  {
    title: "Desktop",
    Icon: Monitor,
    presets: [
      { label: "720p", width: 1280, height: 720 },
      { label: "1080p", width: 1920, height: 1080 },
      { label: "1440p", width: 2560, height: 1440 },
      { label: "4K", width: 3840, height: 2160 },
    ],
  },
  {
    title: "Vertical",
    Icon: Smartphone,
    presets: [
      { label: "720p", width: 720, height: 1280 },
      { label: "1080p", width: 1080, height: 1920 },
      { label: "1440p", width: 1440, height: 2560 },
      { label: "4K", width: 2160, height: 3840 },
    ],
  },
] as const;

/** Matches updateSceneSchema, so the dialog can't offer a size the server refuses. */
const MIN_DIMENSION = 100;
const MAX_WIDTH = 7680;
const MAX_HEIGHT = 4320;

interface ResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: SceneSize;
  onApply: (width: number, height: number, mode: ResolutionChangeMode) => void;
}

export function ResolutionDialog({
  open,
  onOpenChange,
  current,
  onApply,
}: ResolutionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Canvas size</DialogTitle>
          <DialogDescription>
            Match this to your OBS canvas. Nothing changes for viewers until you save.
          </DialogDescription>
        </DialogHeader>

        {/*
          The form lives in its own component so closing the dialog unmounts it.
          Reopening then starts from the scene's current size without an effect
          reaching in to reset the fields.
        */}
        <ResolutionForm
          current={current}
          onApply={onApply}
          onCancel={() => onOpenChange(false)}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ResolutionForm({
  current,
  onApply,
  onCancel,
  onDone,
}: {
  current: SceneSize;
  onApply: (width: number, height: number, mode: ResolutionChangeMode) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [width, setWidth] = useState(current.width);
  const [height, setHeight] = useState(current.height);
  const [mode, setMode] = useState<ResolutionChangeMode>("scale");

  const unchanged = width === current.width && height === current.height;

  return (
    <>
      <div className="space-y-4">
        {PRESET_ROWS.map((row) => (
          <div key={row.title} className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <row.Icon className="h-3.5 w-3.5 text-muted-foreground" />
              {row.title}
            </Label>
            <div className="grid grid-cols-4 gap-1.5">
              {row.presets.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant={
                    width === preset.width && height === preset.height
                      ? "secondary"
                      : "outline"
                  }
                  size="sm"
                  className="h-8 text-xs"
                  title={`${preset.width}x${preset.height}`}
                  onClick={() => {
                    setWidth(preset.width);
                    setHeight(preset.height);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Width</Label>
            <NumberField
              value={width}
              min={MIN_DIMENSION}
              max={MAX_WIDTH}
              onCommit={setWidth}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Height</Label>
            <NumberField
              value={height}
              min={MIN_DIMENSION}
              max={MAX_HEIGHT}
              onCommit={setHeight}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">What happens to your widgets</Label>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant={mode === "scale" ? "secondary" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setMode("scale")}
            >
              Scale to fit
            </Button>
            <Button
              type="button"
              variant={mode === "keep" ? "secondary" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setMode("keep")}
            >
              Keep positions
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {describeResolutionChange(mode, current, { width, height })}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={unchanged}
          onClick={() => {
            onApply(width, height, mode);
            onDone();
          }}
        >
          Change size
        </Button>
      </DialogFooter>
    </>
  );
}
