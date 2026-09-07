"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button, Input, Label } from "@repo/ui";
import { cn } from "@repo/ui";
import type { Scene, SceneItem } from "@repo/obs-web";
import { ALERTS_SCENE_NAME, WELCOME_SCENE_NAME } from "@/lib/obs-irl";

interface ObsAlertsSourcesProps {
  scenes: Scene[];
  alertSceneItems: SceneItem[];
  canInteract: boolean;
  onAddSource: (sceneName: string, inputName: string, url: string) => Promise<void>;
  onAddSourceClone: (sceneName: string, inputName: string, sourceName: string) => Promise<void>;
}

/**
 * Lets the user drop an alert widget (StreamElements, SoundAlerts,
 * Streamlabs, etc.) into the pre-built "_alerts" scene every Cloud OBS
 * instance ships with, then repeat it into whichever other scenes the user
 * picks — as a Source Clone (the exeldro plugin bundled with every instance),
 * not a second browser source. A duplicate browser source per scene runs a
 * second browser process each time; a clone just mirrors the render, so
 * adding it to five scenes doesn't multiply the container's CPU load.
 */
export function ObsAlertsSources({
  scenes,
  alertSceneItems,
  canInteract,
  onAddSource,
  onAddSourceClone,
}: ObsAlertsSourcesProps) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const selectableScenes = scenes.filter((scene) => scene.sceneName !== WELCOME_SCENE_NAME);

  const toggleScene = (sceneName: string) => {
    setSelectedScenes((prev) =>
      prev.includes(sceneName) ? prev.filter((s) => s !== sceneName) : [...prev, sceneName],
    );
  };

  const handleAdd = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    const sourceName = label.trim() || "Alert widget";
    setSubmitting(true);
    try {
      await onAddSource(ALERTS_SCENE_NAME, sourceName, trimmedUrl);
      await Promise.all(
        selectedScenes.map((sceneName) => onAddSourceClone(sceneName, `${sourceName} clone`, sourceName)),
      );
      toast.success("Alert source added", {
        description:
          selectedScenes.length > 0
            ? `Dropped into "${ALERTS_SCENE_NAME}" and cloned into ${selectedScenes.length} scene${selectedScenes.length > 1 ? "s" : ""}.`
            : `Dropped into your "${ALERTS_SCENE_NAME}" scene.`,
      });
      setLabel("");
      setUrl("");
      setSelectedScenes([]);
    } catch (err) {
      toast.error("Couldn't add that source", {
        description: err instanceof Error ? err.message : "Try again?",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="alert-source-label">Label</Label>
          <Input
            id="alert-source-label"
            placeholder="e.g. Alerts"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alert-source-url">Widget URL</Label>
          <Input
            id="alert-source-url"
            placeholder="StreamElements, SoundAlerts, Streamlabs, or any browser source URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={submitting}
            className="font-mono text-xs"
          />
        </div>
      </div>

      {selectableScenes.length > 0 && (
        <div className="space-y-1.5">
          <Label>Also show it in (optional)</Label>
          <div className="flex flex-wrap gap-1.5">
            {selectableScenes.map((scene) => {
              const selected = selectedScenes.includes(scene.sceneName);
              return (
                <button
                  key={scene.sceneName}
                  type="button"
                  onClick={() => toggleScene(scene.sceneName)}
                  disabled={submitting}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input text-muted-foreground hover:bg-muted",
                  )}
                >
                  {scene.sceneName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Plays through OBS, not your phone or encoder. Skip the IRL scene above if your phone
        already plays alerts locally, or you&apos;ll hear each one twice.
      </p>

      {alertSceneItems.length > 0 && (
        <p className="text-xs text-muted-foreground/70">
          Already in {ALERTS_SCENE_NAME}: {alertSceneItems.map((item) => item.sourceName).join(", ")}
        </p>
      )}

      <Link
        href="/dashboard/overlays"
        className="block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Or use StreamWizard&apos;s own alerts from the Overlay Editor instead
      </Link>

      <Button onClick={handleAdd} disabled={!canInteract || !url.trim() || submitting} size="sm">
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : (
          <Plus className="h-3.5 w-3.5 mr-1.5" />
        )}
        {submitting ? "Adding…" : "Add source"}
      </Button>
    </div>
  );
}
