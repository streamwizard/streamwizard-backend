"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AutoSwitcherStatus } from "@repo/schemas";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { Hand, Loader2 } from "lucide-react";
import type { Scene } from "./use-obs-websocket";

const DURATIONS = [
  { label: "15 minutes", value: "15" },
  { label: "1 hour", value: "60" },
  { label: "Until I release it", value: "manual" },
] as const;

export interface AutoSwitcherOverrideControlsProps {
  scenes: Scene[];
  status: AutoSwitcherStatus | null;
  enabled: boolean;
  /**
   * Server actions supplied by the host app. The dashboard acts on the signed-in
   * streamer, web-admin acts on the instance's owner — same UI, different scope.
   */
  onHold: (sceneUuid: string, sceneName: string, durationMinutes: number | null) => Promise<{ ok: boolean; error?: string }>;
  onRelease: () => Promise<{ ok: boolean; error?: string }>;
}

// Manual override: hold one scene while auto-switching stands down. Clearing
// (or expiry) hands control back to the engine, which re-checks the link
// before going back to the live scene.
export function AutoSwitcherOverrideControls({
  scenes,
  status,
  enabled,
  onHold,
  onRelease,
}: AutoSwitcherOverrideControlsProps) {
  const [sceneUuid, setSceneUuid] = useState<string>("");
  const [duration, setDuration] = useState<string>("manual");
  const [busy, setBusy] = useState(false);

  if (!enabled) return null;

  const overrideActive = status?.override != null;

  async function hold() {
    const scene = scenes.find((s) => s.sceneUuid === sceneUuid);
    if (!scene) return;
    setBusy(true);
    const result = await onHold(scene.sceneUuid, scene.sceneName, duration === "manual" ? null : Number(duration));
    setBusy(false);
    if (result.ok) toast.success(`Holding "${scene.sceneName}" — auto switching is paused.`);
    else toast.error(result.error ?? "Could not set the override");
  }

  async function release() {
    setBusy(true);
    const result = await onRelease();
    setBusy(false);
    if (result.ok) toast.success("Released — auto switching is back on.");
    else toast.error(result.error ?? "Could not clear the override");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Hand className="h-4 w-4" />
          Hold a scene
        </CardTitle>
        <CardDescription>Need the switcher out of the way for a bit? Hold a scene and it won&apos;t touch anything until you release it.</CardDescription>
      </CardHeader>
      <CardContent>
        {overrideActive ? (
          <div className="flex items-center gap-3">
            <p className="text-sm">
              Holding <span className="font-medium">{status?.override?.scene_name ?? "scene"}</span>
            </p>
            <Button variant="outline" size="sm" onClick={release} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Release
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sceneUuid} onValueChange={setSceneUuid}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder={scenes.length ? "Pick a scene" : "Connect OBS to pick a scene"} />
              </SelectTrigger>
              <SelectContent>
                {scenes.map((scene) => (
                  <SelectItem key={scene.sceneUuid} value={scene.sceneUuid}>
                    {scene.sceneName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={hold} disabled={!sceneUuid || busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Hold scene
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
