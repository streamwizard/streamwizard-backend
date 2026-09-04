"use client";

import { useState } from "react";
import { ImagePlus, Music, Plus, Shapes, Type, Video } from "lucide-react";
import { createClip, createDefaultBase, createDefaultSource, createLayer, type ClipSource, type LayerType } from "@repo/alert-scene";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@repo/ui";
import { AssetPickerDialog } from "@/components/media/asset-picker-dialog";
import type { AssetKind } from "@/actions/assets";
import { addClipCommand, addLayerCommand, compositeCommand } from "./commands";
import { probeMediaInfo } from "./media-info";
import { fitBox } from "./media-math";
import { fileNameFromUrl } from "./media-url";
import { useTimelineStoreApi } from "./timeline-context";
import { newClipRange } from "./timeline/timeline-math";

type Picker = Extract<AssetKind, "image" | "video" | "audio">;

const PICKER_TITLES: Record<Picker, string> = { image: "Pick an image", video: "Pick a video", audio: "Pick a sound" };

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
  const [picker, setPicker] = useState<Picker | null>(null);

  const add = (type: LayerType, source: ClipSource, box: { width: number; height: number }, name: string, lengthMs?: number) => {
    const s = api.getState();
    const { scene, playhead } = s;
    const layer = createLayer(type, name);
    const { start, end } = newClipRange(scene, playhead, lengthMs);
    const clip = createClip({ start, end, source, base: createDefaultBase(scene, box) });
    s.execute(compositeCommand(`Add ${type} layer`, [addLayerCommand(layer), addClipCommand(layer.id, clip)]));
    s.select({ layerId: layer.id, clipId: clip.id, keyframe: null });
  };

  /** 60% of the scene, square when the picture size is unknown. */
  const boxFor = (natural: { width: number; height: number } | null) => {
    const { scene } = api.getState();
    const max = { width: scene.width * 0.6, height: scene.height * 0.6 };
    const side = Math.round(Math.min(max.width, max.height));
    return natural ? fitBox(natural, max) : { width: side, height: side };
  };

  const addText = () => {
    const { scene } = api.getState();
    const source = { ...createDefaultSource("text"), text: "{name}" } as ClipSource;
    add("text", source, { width: Math.round(scene.width * 0.8), height: 80 }, "Text");
  };

  const addImage = async (url: string) => {
    add("image", { kind: "image", url, fit: "contain" }, boxFor(await probeImage(url)), "Image");
  };

  // Media clips run as long as the file, capped by the scene.
  const addVideo = async (url: string) => {
    const info = await probeMediaInfo(url, { kind: "video" });
    const natural = info?.width && info.height ? { width: info.width, height: info.height } : null;
    add("video", { kind: "video", url, loop: false, fit: "contain" }, boxFor(natural), fileNameFromUrl(url) || "Video", info?.durationMs ?? undefined);
  };

  const addAudio = async (url: string) => {
    const info = await probeMediaInfo(url, { kind: "audio" });
    add("audio", { kind: "audio", url }, { width: 0, height: 0 }, fileNameFromUrl(url) || "Sound", info?.durationMs ?? undefined);
  };

  const addShape = () => add("shape", createDefaultSource("shape"), { width: 200, height: 200 }, "Shape");

  const onPicked = (url: string) => {
    const kind = picker;
    setPicker(null);
    if (kind === "image") void addImage(url);
    else if (kind === "video") void addVideo(url);
    else if (kind === "audio") void addAudio(url);
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
          <DropdownMenuItem onSelect={() => setPicker("image")}>
            <ImagePlus className="size-4" />
            Image
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPicker("video")}>
            <Video className="size-4" />
            Video
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPicker("audio")}>
            <Music className="size-4" />
            Sound
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={addShape}>
            <Shapes className="size-4" />
            Shape
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AssetPickerDialog
        open={picker !== null}
        onOpenChange={(open) => !open && setPicker(null)}
        kindFilter={picker ? [picker] : undefined}
        title={picker ? PICKER_TITLES[picker] : undefined}
        onSelect={(asset) => onPicked(asset.url)}
      />
    </>
  );
}
