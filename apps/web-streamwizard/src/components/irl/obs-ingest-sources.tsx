"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus, Radio } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { listOutputKeys, type IngestOutputKey } from "@/actions/ingest-output-keys";
import type { Scene } from "@repo/obs-web";
import { obsPullUrl } from "@/lib/obs-irl";
import { IngestLiveStats } from "./ingest-live-stats";

interface ObsIngestSourcesProps {
  scenes: Scene[];
  currentScene: string | null;
  canInteract: boolean;
  onAddToScene: (sceneName: string, inputName: string, url: string) => Promise<void>;
  obsPullHost: string;
}

export function ObsIngestSources({
  scenes,
  currentScene,
  canInteract,
  onAddToScene,
  obsPullHost,
}: ObsIngestSourcesProps) {
  const [keys, setKeys] = useState<IngestOutputKey[] | null>(null);
  const [activeKey, setActiveKey] = useState<IngestOutputKey | null>(null);
  const [dialogScene, setDialogScene] = useState<string>("");
  const [sourceName, setSourceName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  // Per-key, sticky confirmation of where it landed, since the toast alone
  // faded before the destination registered.
  const [addedTo, setAddedTo] = useState<Record<string, string>>({});

  useEffect(() => {
    listOutputKeys().then(({ data }) => setKeys(data ?? []));
  }, []);

  const openDialogFor = (key: IngestOutputKey) => {
    setActiveKey(key);
    setDialogScene(currentScene ?? scenes[0]?.sceneName ?? "");
    setSourceName(`Ingest - ${key.label}`);
  };

  const handleConfirm = async () => {
    const trimmedName = sourceName.trim();
    if (!activeKey || !dialogScene || !trimmedName) return;
    setSubmitting(true);
    try {
      await onAddToScene(dialogScene, trimmedName, obsPullUrl(obsPullHost, activeKey.output_key));
      setAddedTo((prev) => ({ ...prev, [activeKey.id]: dialogScene }));
      toast.success(`Added "${trimmedName}" to ${dialogScene}`);
      setActiveKey(null);
    } catch (err) {
      toast.error("Couldn't add that source", {
        description: err instanceof Error ? err.message : "Try again?",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <IngestLiveStats />

      <div className="space-y-3 border-t pt-6">
        {keys === null ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center px-4">
            <Radio className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No incoming signal yet</p>
            <p className="text-xs text-muted-foreground/55 max-w-xs leading-relaxed">
              Create an ingest key above, then drop it into a scene here.
            </p>
          </div>
        ) : scenes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No scenes found</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              Your incoming signal. Drop it into any scene as a media source.
            </p>

            <div className="space-y-2">
              {keys.map((key) => {
                const landedIn = addedTo[key.id];
                return (
                  <div key={key.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{key.label}</p>
                      {landedIn && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400 shrink-0">
                          <Check className="h-3 w-3" />
                          In {landedIn}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canInteract}
                      onClick={() => openDialogFor(key)}
                      className="shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add source
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Dialog open={activeKey !== null} onOpenChange={(open) => !open && setActiveKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add &ldquo;{activeKey?.label}&rdquo; to a scene</DialogTitle>
            <DialogDescription>
              Your incoming signal from the ingest server. Name it, pick a scene.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ingest-source-name">Source name</Label>
              <Input
                id="ingest-source-name"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. Backup cam"
              />
            </div>

            <div className="space-y-2">
              <Label>Scene</Label>
              <Select value={dialogScene} onValueChange={setDialogScene}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a scene" />
                </SelectTrigger>
                <SelectContent>
                  {scenes.map((s) => (
                    <SelectItem key={s.sceneName} value={s.sceneName}>{s.sceneName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveKey(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!dialogScene || !sourceName.trim() || submitting}>
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Add to scene
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
