"use client";

import {
  Button,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Switch,
} from "@repo/ui";
import { Eye, Magnet } from "lucide-react";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import { NumberField } from "./number-field";
import {
  CANVAS_BACKGROUND_LABELS,
  GRID_COLOR_PRESETS,
  GRID_LINE_WIDTH_MAX,
  GRID_LINE_WIDTH_MIN,
  GRID_SIZE_MAX,
  GRID_SIZE_MIN,
  type CanvasBackground,
} from "./canvas-preferences";
import { CANVAS_BACKGROUND_STYLES } from "./canvas-background";

const BACKGROUNDS = Object.keys(CANVAS_BACKGROUND_LABELS) as CanvasBackground[];

/**
 * Design-time canvas aids. Everything here is a working preference: it follows
 * the streamer between scenes and never reaches the overlay itself.
 */
export function CanvasViewPopover() {
  const canvasBackground = useOverlayStore((s) => s.canvasBackground);
  const setCanvasBackground = useOverlayStore((s) => s.setCanvasBackground);
  const grid = useOverlayStore((s) => s.grid);
  const setGrid = useOverlayStore((s) => s.setGrid);
  const snapToItems = useOverlayStore((s) => s.snapToItems);
  const setSnapToItems = useOverlayStore((s) => s.setSnapToItems);
  const rulersVisible = useOverlayStore((s) => s.rulersVisible);
  const setRulersVisible = useOverlayStore((s) => s.setRulersVisible);
  const rulerCursorVisible = useOverlayStore((s) => s.rulerCursorVisible);
  const setRulerCursorVisible = useOverlayStore((s) => s.setRulerCursorVisible);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8" title="Canvas view">
          <Eye className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Behind your widgets</Label>
          <div className="grid grid-cols-5 gap-1.5">
            {BACKGROUNDS.map((background) => (
              <button
                key={background}
                type="button"
                aria-label={CANVAS_BACKGROUND_LABELS[background]}
                title={CANVAS_BACKGROUND_LABELS[background]}
                onClick={() => setCanvasBackground(background)}
                className={`h-7 rounded border transition-colors ${
                  canvasBackground === background
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-foreground/40"
                }`}
                style={CANVAS_BACKGROUND_STYLES[background]}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Only you see this. Your overlay stays transparent.
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Grid</Label>
            <Switch
              checked={grid.visible}
              onCheckedChange={(visible) => setGrid({ visible })}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground shrink-0">Every</span>
            <NumberField
              value={grid.size}
              min={GRID_SIZE_MIN}
              max={GRID_SIZE_MAX}
              onCommit={(size) => setGrid({ size })}
              className="h-7"
            />
            <span className="text-[11px] text-muted-foreground shrink-0">px</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground shrink-0">Lines</span>
            <NumberField
              value={grid.lineWidth}
              min={GRID_LINE_WIDTH_MIN}
              max={GRID_LINE_WIDTH_MAX}
              onCommit={(lineWidth) => setGrid({ lineWidth })}
              className="h-7"
            />
            <span className="text-[11px] text-muted-foreground shrink-0">px thick</span>
          </div>

          <div className="flex items-center gap-1.5">
            {GRID_COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Grid colour ${color}`}
                title={color}
                onClick={() => setGrid({ color })}
                className={`h-6 w-6 rounded border transition-colors ${
                  grid.color.toLowerCase() === color.toLowerCase()
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-foreground/40"
                }`}
                style={{ background: color }}
              />
            ))}
            {/* Anything the presets don't cover. */}
            <input
              type="color"
              aria-label="Pick a grid colour"
              title="Pick a grid colour"
              value={grid.color}
              onChange={(e) => setGrid({ color: e.target.value })}
              className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
            />
          </div>

        </div>

        <Separator />

        {/* Both kinds of snapping in one place: they are the same idea, and
            splitting them across sections made the grid look like the only one. */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs">
            <Magnet className="h-3.5 w-3.5 text-muted-foreground" />
            Snapping
          </Label>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-normal text-muted-foreground">
              To widgets, left and right
            </Label>
            <Switch
              checked={snapToItems.x}
              onCheckedChange={(x) => setSnapToItems({ x })}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-normal text-muted-foreground">
              To widgets, top and bottom
            </Label>
            <Switch
              checked={snapToItems.y}
              onCheckedChange={(y) => setSnapToItems({ y })}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-normal text-muted-foreground">
              To the grid
            </Label>
            <Switch checked={grid.snap} onCheckedChange={(snap) => setGrid({ snap })} />
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Hold Alt while dragging to flip whichever is on, for that drag only.
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Rulers</Label>
            <Switch checked={rulersVisible} onCheckedChange={setRulersVisible} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label
              className={`text-xs font-normal ${
                rulersVisible ? "text-muted-foreground" : "text-muted-foreground/50"
              }`}
            >
              Follow the cursor
            </Label>
            <Switch
              checked={rulerCursorVisible}
              disabled={!rulersVisible}
              onCheckedChange={setRulerCursorVisible}
            />
          </div>
        </div>

        <Separator />

        {/*
          Stands in for safe-area guides: Twitch scales the stream to each
          viewer's player and draws its UI over that, so what it covers is a
          proportion of the player, not a fixed rectangle we could mark out on a
          1920x1080 canvas. A sentence that is true beats guides that are
          precisely wrong.
        */}
        <p className="text-[11px] text-muted-foreground leading-snug">
          Twitch draws its own controls over your stream, mostly along the bottom
          edge. Keep anything that has to stay readable away from the edges.
        </p>
      </PopoverContent>
    </Popover>
  );
}
