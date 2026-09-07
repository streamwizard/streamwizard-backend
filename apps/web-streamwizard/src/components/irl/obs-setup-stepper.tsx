"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ExternalLink, Loader2, Rocket, Wifi } from "lucide-react";
import { Button, Card, CardContent, Input, Label } from "@repo/ui";
import { createIngestKey, type IngestStreamKey } from "@/actions/ingest-keys";
import type { Scene, SceneItem } from "@repo/obs-web";
import { ObsAlertsSources } from "@/components/irl/obs-alerts-sources";
import { cn } from "@repo/ui";

interface ObsSetupStepperProps {
  canInteract: boolean;
  hasKey: boolean;
  onKeyCreated: (key: IngestStreamKey) => void;
  instanceId: string | null;
  containerStatus: "running" | "stopped" | "unknown";
  launching: boolean;
  togglingContainer: boolean;
  launchError: string | null;
  onLaunch: () => void;
  onStartContainer: () => void;
  obsStatus: "closed" | "connecting" | "open";
  isBooting: boolean;
  hasTimedOut: boolean;
  onReconnect: () => void;
  hasOpenedViewer: boolean;
  onOpenViewer: () => void;
  scenes: Scene[];
  alertSceneItems: SceneItem[];
  onAddAlertSource: (sceneName: string, inputName: string, url: string) => Promise<void>;
  onAddAlertSourceClone: (sceneName: string, inputName: string, sourceName: string) => Promise<void>;
  onFinishSetup: () => void;
}

/**
 * Walks a first-time (or not-yet-fully-set-up) user through the whole path
 * from "no ingest key" to "OBS is open and ready to go live," one step at a
 * time, with a plain-language line per step. This setup involves several
 * moving pieces (a stream key, a cloud container, OBS itself) that aren't
 * obvious if you're not already familiar with OBS or streaming infra.
 */
export function ObsSetupStepper({
  canInteract,
  hasKey,
  onKeyCreated,
  instanceId,
  containerStatus,
  launching,
  togglingContainer,
  launchError,
  onLaunch,
  onStartContainer,
  obsStatus,
  isBooting,
  hasTimedOut,
  onReconnect,
  hasOpenedViewer,
  onOpenViewer,
  scenes,
  alertSceneItems,
  onAddAlertSource,
  onAddAlertSourceClone,
  onFinishSetup,
}: ObsSetupStepperProps) {
  const [label, setLabel] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [alertsStepDone, setAlertsStepDone] = useState(false);

  const handleCreate = async () => {
    setIsPending(true);
    const { data, error } = await createIngestKey(label);
    setIsPending(false);
    if (error || !data) {
      toast.error(error ?? "Couldn't create that key. Try again.");
      return;
    }
    setLabel("");
    onKeyCreated(data);
    toast.success("Ingest key created", {
      description: "We'll wire it into your IRL scene once OBS connects.",
    });
  };

  const containerRunning = containerStatus === "running";
  const containerBusy = launching || togglingContainer;
  const containerButtonLabel = !instanceId ? "Launch Cloud OBS" : "Start container";

  return (
    <Card>
      <CardContent className="space-y-6 py-8">
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium">Set up your IRL stream</p>
          <p className="text-sm text-muted-foreground">
            A few steps and you&apos;re live. We&apos;ll explain each one as you go.
          </p>
        </div>

        <ol className="mx-auto max-w-md space-y-5">
          <Step number={1} done={hasKey} label="Create an ingest key">
            <p className="text-xs text-muted-foreground">
              The private address your phone or encoder streams to. Treat it like a password.
            </p>
            {hasKey ? (
              <p className="text-sm text-muted-foreground">Done. Key created.</p>
            ) : (
              <div className="flex items-center gap-2">
                <Label htmlFor="setup-key-label" className="sr-only">
                  Key label
                </Label>
                <Input
                  id="setup-key-label"
                  placeholder="Label (e.g. Belabox, phone, backup)"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={isPending}
                />
                <Button onClick={handleCreate} disabled={!canInteract || isPending} className="shrink-0">
                  {isPending ? "Creating…" : "Create key"}
                </Button>
              </div>
            )}
          </Step>

          <Step number={2} done={containerRunning} label="Launch your cloud container" locked={!hasKey}>
            <p className="text-xs text-muted-foreground">
              A private OBS instance that runs in the cloud, even when your PC is off.
            </p>
            {containerRunning ? (
              <p className="text-sm text-muted-foreground">Done. Container running.</p>
            ) : (
              <div>
                <Button
                  onClick={!instanceId ? onLaunch : onStartContainer}
                  disabled={!canInteract || !hasKey || containerBusy}
                >
                  {containerBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Rocket className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {containerBusy ? "Working…" : containerButtonLabel}
                </Button>
                {launchError && <p className="mt-1 text-xs text-destructive">{launchError}</p>}
              </div>
            )}
          </Step>

          <Step number={3} done={obsStatus === "open"} label="OBS boots up inside it" locked={!containerRunning}>
            <p className="text-xs text-muted-foreground">
              Automatic. Takes 10 to 30 seconds, nothing to click here.
            </p>
            {obsStatus === "open" ? (
              <p className="text-sm text-muted-foreground">Done. OBS connected.</p>
            ) : hasTimedOut ? (
              <div>
                <p className="text-sm text-destructive">OBS never came online.</p>
                <Button size="sm" variant="outline" onClick={onReconnect} className="mt-1">
                  <Wifi className="h-3.5 w-3.5 mr-1.5" />
                  Retry connection
                </Button>
              </div>
            ) : containerRunning ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {isBooting ? "Booting…" : "Connecting…"}
              </p>
            ) : null}
          </Step>

          <Step number={4} done={alertsStepDone} label="Add alert sources (optional)" locked={obsStatus !== "open"}>
            <p className="text-xs text-muted-foreground">
              Sound alerts for follows, subs, or donations. Add one now, or skip and set it up in
              OBS later.
            </p>
            {alertsStepDone ? (
              <p className="text-sm text-muted-foreground">Done.</p>
            ) : (
              obsStatus === "open" && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                  <ObsAlertsSources
                    scenes={scenes}
                    alertSceneItems={alertSceneItems}
                    canInteract={canInteract}
                    onAddSource={onAddAlertSource}
                    onAddSourceClone={onAddAlertSourceClone}
                  />
                  <div className="flex items-center gap-2 border-t pt-3">
                    <Button variant="outline" size="sm" onClick={() => setAlertsStepDone(true)}>
                      Skip
                    </Button>
                    <Button size="sm" onClick={() => setAlertsStepDone(true)}>
                      Done adding alerts
                    </Button>
                  </div>
                </div>
              )
            )}
          </Step>

          <Step number={5} done={hasOpenedViewer} label="Open OBS" locked={!alertsStepDone}>
            <p className="text-xs text-muted-foreground">
              A live view of your cloud OBS, just like the desktop app. Check your camera,
              arrange your scenes, then hit Go live.
            </p>
            {hasOpenedViewer ? (
              <p className="text-sm text-muted-foreground">Done. Opened.</p>
            ) : (
              alertsStepDone && (
                <Button
                  onClick={() => {
                    onOpenViewer();
                    onFinishSetup();
                  }}
                  disabled={!canInteract}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open OBS
                </Button>
              )
            )}
          </Step>
        </ol>

        {hasTimedOut && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>Your container is running, but we can&apos;t reach OBS inside it yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Step({
  number,
  done,
  label,
  locked = false,
  children,
}: {
  number: number;
  done: boolean;
  label: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className={cn("flex gap-3", locked && "opacity-50")}>
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : number}
      </span>
      <div className="flex-1 space-y-2 pt-0.5">
        <p className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>{label}</p>
        {children}
      </div>
    </li>
  );
}
