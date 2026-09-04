"use client";

import { useState } from "react";
import { ChevronRight, Eye, EyeOff, ImageIcon, Lock, LockOpen, Music, Shapes, Trash2, Type, Video, Volume2, VolumeX } from "lucide-react";
import type { Layer, LayerType } from "@repo/alert-scene";
import { Button, Input, cn } from "@repo/ui";
import { removeLayerCommand, updateLayerCommand } from "../commands";
import { useTimeline, useTimelineStoreApi } from "../timeline-context";
import { LAYER_ICON_CLASSES, LAYER_TYPE_LABELS } from "./layer-colors";
import { ROW_HEIGHT_PX } from "./timeline-constants";
import { layerHasTracks } from "./timeline-rows";

const ICONS: Record<LayerType, typeof Type> = { text: Type, image: ImageIcon, video: Video, audio: Music, shape: Shapes };

function Toggle({
  on,
  onLabel,
  offLabel,
  OnIcon,
  OffIcon,
  onClick,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  OnIcon: typeof Eye;
  OffIcon: typeof Eye;
  onClick: () => void;
}) {
  const Icon = on ? OnIcon : OffIcon;
  return (
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      aria-label={on ? onLabel : offLabel}
      aria-pressed={on}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn("text-muted-foreground", !on && "text-foreground")}
    >
      <Icon />
    </Button>
  );
}

export function LayerHeader({ layer }: { layer: Layer }) {
  const api = useTimelineStoreApi();
  const selected = useTimeline((s) => s.selection.layerId === layer.id);
  const expanded = useTimeline((s) => !!s.expandedLayerIds[layer.id]);
  const animated = layerHasTracks(layer);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(layer.name);
  const Icon = ICONS[layer.type];
  const hasSound = layer.type === "video" || layer.type === "audio";

  const patch = (p: Parameters<typeof updateLayerCommand>[2]) => {
    const s = api.getState();
    const cmd = updateLayerCommand(s.scene, layer.id, p);
    if (cmd) s.execute(cmd);
  };

  const commitRename = () => {
    setRenaming(false);
    const name = draftName.trim();
    if (name && name !== layer.name) patch({ name });
  };

  return (
    <div
      className={cn("group flex items-center gap-1 border-b border-border/60 px-2", selected ? "bg-primary/10" : "hover:bg-muted/40")}
      style={{ height: ROW_HEIGHT_PX }}
      onPointerDown={() => api.getState().select({ layerId: layer.id, clipId: layer.clips[0]?.id ?? null, keyframe: null })}
      onDoubleClick={() => {
        setDraftName(layer.name);
        setRenaming(true);
      }}
    >
      <button
        type="button"
        aria-label={expanded ? "Hide animated properties" : "Show animated properties"}
        aria-expanded={expanded}
        disabled={!animated}
        title={animated ? undefined : "Nothing animated yet. Press a stopwatch in the inspector."}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          api.getState().toggleLayerExpanded(layer.id);
        }}
        className={cn(
          "-ml-1 flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
        )}
      >
        <ChevronRight className={cn("size-3 transition-transform", expanded && "rotate-90")} />
      </button>
      <Icon className={cn("size-3.5 shrink-0", LAYER_ICON_CLASSES[layer.type])} aria-label={LAYER_TYPE_LABELS[layer.type]} />
      {renaming ? (
        <Input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              e.stopPropagation();
              setRenaming(false);
            }
          }}
          className="h-6 flex-1 px-1 text-xs"
        />
      ) : (
        <span className={cn("flex-1 truncate text-xs", !layer.visible && "text-muted-foreground line-through")} title="Double-click to rename">
          {layer.name || LAYER_TYPE_LABELS[layer.type]}
        </span>
      )}
      {/* Hidden until hover, unless a toggle is already off: a hidden or locked layer must announce itself. */}
      <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 has-[[aria-pressed=false]]:opacity-100">
        {/* A sound layer has nothing to hide; mute is its switch. */}
        {layer.type !== "audio" && (
          <Toggle on={layer.visible} onLabel="Hide layer" offLabel="Show layer" OnIcon={Eye} OffIcon={EyeOff} onClick={() => patch({ visible: !layer.visible })} />
        )}
        <Toggle on={!layer.locked} onLabel="Lock layer" offLabel="Unlock layer" OnIcon={LockOpen} OffIcon={Lock} onClick={() => patch({ locked: !layer.locked })} />
        {hasSound && <Toggle on={!layer.muted} onLabel="Mute layer" offLabel="Unmute layer" OnIcon={Volume2} OffIcon={VolumeX} onClick={() => patch({ muted: !layer.muted })} />}
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Delete layer"
          className="text-muted-foreground hover:text-destructive"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            const s = api.getState();
            const cmd = removeLayerCommand(s.scene, layer.id);
            if (cmd) s.execute(cmd);
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}
