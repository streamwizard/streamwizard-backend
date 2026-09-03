"use client";

import { useState } from "react";
import { ImagePlus, Plus, Type } from "lucide-react";
import {
  createClip,
  createDefaultBase,
  createDefaultSource,
  createLayer,
  MIN_CLIP_MS,
  type AlertScene,
  type ClipSource,
  type LayerType,
} from "@repo/alert-scene";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@repo/ui";
import { AssetPickerDialog } from "@/components/media/asset-picker-dialog";
import { addClipCommand, addLayerCommand, compositeCommand } from "./commands";
import { useTimelineStoreApi } from "./timeline-context";

const DEFAULT_CLIP_MS = 3000;

/** New clips land at the playhead, or at the start when the playhead sits at the end. */
export function newClipRange(scene: Pick<AlertScene, "duration">, playhead: number): { start: number; end: number } {
  const start = playhead >= scene.duration - MIN_CLIP_MS ? 0 : Math.max(0, playhead);
  const end = Math.max(start + MIN_CLIP_MS, Math.min(scene.duration, start + DEFAULT_CLIP_MS));
  return { start, end };
}

function probeImage(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function AddLayerMenu() {
  const api = useTimelineStoreApi();
  const [pickerOpen, setPickerOpen] = useState(false);

  const add = (type: LayerType, source: ClipSource, box: { width: number; height: number }, name: string) => {
    const s = api.getState();
    const { scene, playhead } = s;
    const layer = createLayer(type, name);
    const { start, end } = newClipRange(scene, playhead);
    const clip = createClip({ start, end, source, base: createDefaultBase(scene, box) });
    s.execute(compositeCommand(`Add ${type} layer`, [addLayerCommand(layer), addClipCommand(layer.id, clip)]));
    s.select({ layerId: layer.id, clipId: clip.id, keyframe: null });
  };

  const addText = () => {
    const { scene } = api.getState();
    const source = { ...createDefaultSource("text"), text: "{name}" } as ClipSource;
    add("text", source, { width: Math.round(scene.width * 0.8), height: 80 }, "Text");
  };

  const addImage = async (url: string) => {
    const { scene } = api.getState();
    const natural = await probeImage(url);
    const maxW = scene.width * 0.6;
    const maxH = scene.height * 0.6;
    let box = { width: Math.round(Math.min(maxW, maxH)), height: Math.round(Math.min(maxW, maxH)) };
    if (natural) {
      const scale = Math.min(maxW / natural.width, maxH / natural.height, 1);
      box = { width: Math.round(natural.width * scale), height: Math.round(natural.height * scale) };
    }
    add("image", { kind: "image", url, fit: "contain" }, box, "Image");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="size-3.5" />
            Add layer
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={addText}>
            <Type className="size-4" />
            Text
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPickerOpen(true)}>
            <ImagePlus className="size-4" />
            Image
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AssetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kindFilter={["image"]}
        title="Pick an image"
        onSelect={(asset) => {
          setPickerOpen(false);
          void addImage(asset.url);
        }}
      />
    </>
  );
}
