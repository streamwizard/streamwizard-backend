"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@repo/ui";
import { Wifi, Loader2, AlertTriangle, Gauge, Layers, FolderUp, Repeat } from "lucide-react";
import { useCloudObsInstance } from "@/hooks/obs/use-cloud-obs-instance";
import { deriveObsFlowState } from "@/components/irl/cloud-obs/obs-flow-state";
import { ObsStatusBadge } from "@/components/irl/cloud-obs/obs-status-badge";
import { CloudObsSetupScreen } from "@/components/irl/cloud-obs/cloud-obs-setup-screen";
import { ObsContainerControl, ObsStreamControl } from "@/components/irl/cloud-obs/obs-container-control";
import { ObsVncPreview } from "@/components/irl/obs-vnc-preview";
import { ObsBootProgress } from "@/components/irl/obs-boot-progress";
import { ObsOfflineState } from "@/components/irl/obs-offline-state";
import { ObsLifecycleBanner } from "@/components/irl/obs-lifecycle-banner";
import { ObsSourceProfiler } from "@/components/irl/obs-source-profiler";
import { ObsResourceGraphs } from "@/components/irl/obs-resource-graphs";
import { ObsFileUploader } from "@/components/irl/obs-file-uploader";
import { ObsIngestSources } from "@/components/irl/obs-ingest-sources";
import { FeatureDisabledBanner } from "@/components/ui/feature-disabled-banner";
import type { ProductAccess } from "@/lib/require-product-access";
import type { IngestStreamKey } from "@/actions/ingest-keys";
import type { AutoSwitcherConfigRow } from "@repo/supabase/queries/auto-switcher";
import { AutoSwitcherTab } from "@/components/irl/auto-switcher/auto-switcher-tab";
import { listOutputKeys } from "@/actions/ingest-output-keys";
import { ALERTS_SCENE_NAME, IRL_SCENE_NAME, IRL_SOURCE_NAME, obsPullUrl } from "@/lib/obs-irl";

interface CloudObsContentProps {
  canInteract: boolean;
  plan: ProductAccess["plan"];
  initialIngestKeys: IngestStreamKey[];
  obsPullHost: string;
  autoSwitcherConfig: AutoSwitcherConfigRow | null;
}

export function CloudObsContent({ canInteract, plan: _plan, initialIngestKeys, obsPullHost, autoSwitcherConfig }: CloudObsContentProps) {
  const {
    instanceId,
    apiUrl,
    containerStatus,
    obs,
    launching,
    launchError,
    togglingContainer,
    handleLaunch,
    handleToggleContainer,
    stopReason,
    clearStopReason,
    transition,
  } = useCloudObsInstance();

  const [bootElapsed, setBootElapsed] = useState(0);
  const [ingestKeys, setIngestKeys] = useState<IngestStreamKey[]>(initialIngestKeys);
  // Set once the user opens OBS from the stepper (step 4) — unlocks step 5
  // (alerts, optional) but doesn't end the guided flow by itself.
  const [hasOpenedViewer, setHasOpenedViewer] = useState(false);
  // Set once the user finishes or skips step 5 — this is what actually ends
  // the guided flow and reveals the normal dashboard.
  const [setupComplete, setSetupComplete] = useState(false);
  // Decided once, the moment we know whether this looks like an incomplete
  // setup (no key and/or no container yet). Stays true through the whole
  // launch/boot/connect sequence — even once the key and container both
  // exist — so the guided flow doesn't disappear mid-walkthrough just
  // because a step completed. Only clears once the user finishes step 5.
  // `null` means "not decided yet" (waiting on the initial instance lookup).
  const [onboardingFlow, setOnboardingFlow] = useState<boolean | null>(null);
  // Tracks the containerStatus value onboardingFlow was last derived from, so
  // the "adjust state during render" below only fires the one time
  // containerStatus resolves out of "unknown" — not on every render.
  const [resolvedFor, setResolvedFor] = useState<typeof containerStatus | null>(null);
  // Set when a key is created this session and not yet wired into OBS — lets
  // the auto-wire effect add it silently instead of just notifying. Lost on
  // reload (accepted tradeoff, avoids a persisted "pending wire" flag).
  const justCreatedKeyIdRef = useRef<string | null>(null);

  const handleKeyCreated = (key: IngestStreamKey) => {
    setIngestKeys((prev) => [key, ...prev]);
    justCreatedKeyIdRef.current = key.id;
  };

  const openViewer = () => {
    if (!instanceId) return;
    setHasOpenedViewer(true);
    const params = new URLSearchParams({ instanceId, name: "Cloud OBS" });
    window.open(`/obs-viewer?${params.toString()}`, "obs-viewer", "width=1280,height=800");
  };

  const flow = deriveObsFlowState({
    containerStatus,
    launching,
    togglingContainer,
    obsStatus: obs.status,
    obsHasTimedOut: obs.hasTimedOut,
    obsIsAutoRetrying: obs.isAutoRetrying,
    stopReason,
    transition,
  });
  const { inLaunchFlow, isProvisioning, isBooting, hasTimedOut, stripIsOffline, crashed, isStopping, externalStarting } =
    flow;

  // Lock in whether this is a guided setup once we actually know the user's
  // instance state (containerStatus starts "unknown" until the initial fetch
  // resolves) — a returning user with both a key and a running container
  // never sees the stepper; anyone missing either does, all the way through
  // to opening OBS. Adjusting state during render (rather than in an effect)
  // is the React-blessed way to derive state from a prop/value change once.
  if (containerStatus !== "unknown" && resolvedFor !== containerStatus) {
    setResolvedFor(containerStatus);
    if (onboardingFlow === null) {
      setOnboardingFlow(!instanceId || ingestKeys.length === 0);
    }
  }
  const showSetupStepper = (onboardingFlow ?? false) && !setupComplete;

  // Single elapsed timer that spans the whole launch flow. Keying the effect on
  // the boolean keeps it running continuously across provisioning → booting and
  // only resets once the flow ends.
  useEffect(() => {
    if (!inLaunchFlow) {
      setBootElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setBootElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [inLaunchFlow]);

  // Auto-wire the primary ingest key into the fixed "IRL" scene once OBS is
  // connected and scenes have actually loaded (status flips to "open" slightly
  // before fetchScenes() resolves, so wait for scenes rather than acting on
  // stale/empty data). Only a key created THIS session gets wired silently —
  // everything else is left alone, so we never fight a user who deliberately
  // removed the source. Only the primary (most recent) key is ever auto-wired;
  // creating a second key never rewires "StreamWizard Ingest" onto it, since
  // the fixed source name means detection is keyed by name, not by key. That's
  // intentional — additional keys stay manual-only via the list below.
  useEffect(() => {
    if (obs.status !== "open" || obs.scenes.length === 0) return;
    const primaryKey = ingestKeys[0];
    if (!primaryKey) return;
    if (obs.sceneHasSource(IRL_SCENE_NAME, IRL_SOURCE_NAME)) return;

    let cancelled = false;
    (async () => {
      const { data: outputKeys } = await listOutputKeys(primaryKey.id);
      const outputKey = outputKeys?.[0];
      if (!outputKey || cancelled) return;

      await obs.ensureSceneExists(IRL_SCENE_NAME);
      if (cancelled || obs.sceneHasSource(IRL_SCENE_NAME, IRL_SOURCE_NAME)) return;

      const justCreated = justCreatedKeyIdRef.current === primaryKey.id;
      if (justCreated) {
        try {
          await obs.addMediaSourceToScene(IRL_SCENE_NAME, IRL_SOURCE_NAME, obsPullUrl(obsPullHost, outputKey.output_key));
          justCreatedKeyIdRef.current = null;
          toast.success("Ingest source added to OBS", {
            description: `Your feed is now wired into the "${IRL_SCENE_NAME}" scene.`,
          });
        } catch (err) {
          toast.error("Couldn't auto-add your ingest source", {
            description: err instanceof Error ? err.message : "Add it manually from the Ingest tab.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [obs.status, obs.scenes.length, obs.sceneItems, ingestKeys, obsPullHost]);

  if (showSetupStepper) {
    return (
      <CloudObsSetupScreen
        canInteract={canInteract}
        flow={flow}
        obs={obs}
        instanceId={instanceId}
        containerStatus={containerStatus}
        ingestKeys={ingestKeys}
        launching={launching}
        launchError={launchError}
        togglingContainer={togglingContainer}
        hasOpenedViewer={hasOpenedViewer}
        onKeyCreated={handleKeyCreated}
        onLaunch={handleLaunch}
        onStartContainer={handleToggleContainer}
        onOpenViewer={openViewer}
        onFinishSetup={() => setSetupComplete(true)}
      />
    );
  }

  return (
    <div className="w-full space-y-6">
      {!canInteract && <FeatureDisabledBanner />}

      {/* High-signal banner for a crash (stream just dropped) or a delete. */}
      <ObsLifecycleBanner
        reason={stopReason}
        onRestart={canInteract && instanceId && apiUrl ? handleToggleContainer : undefined}
        restarting={togglingContainer}
        onDismiss={clearStopReason}
      />

      {/* Top section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* VNC preview */}
        <ObsVncPreview
          instanceId={instanceId}
          status={obs.status === "open" ? "connected" : inLaunchFlow ? "booting" : "offline"}
          onOpen={openViewer}
        />

        {/* Right panel */}
        <div className="flex-1 space-y-4">
          {/* Title + WS status */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Cloud OBS</h2>
            <ObsStatusBadge obsStatus={obs.status} containerStatus={containerStatus} flow={flow} />
            {containerStatus === "running" && obs.status === "closed" && !inLaunchFlow && !hasTimedOut && apiUrl && instanceId && (
              <Button size="sm" variant="outline" onClick={obs.reconnect}>
                <Wifi className="h-3.5 w-3.5 mr-1.5" />
                Reconnect
              </Button>
            )}
          </div>

          {/* Launch / boot progress */}
          {inLaunchFlow && (
            <ObsBootProgress phase={isProvisioning ? "provisioning" : "booting"} elapsedSeconds={bootElapsed} />
          )}

          {/* Timed out — container is up but OBS never connected */}
          {hasTimedOut && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="flex-1 space-y-2">
                <p className="text-sm">
                  OBS never came online. Your container is running, but we can&apos;t reach OBS inside it.
                </p>
                <Button size="sm" variant="outline" onClick={obs.reconnect}>
                  <Wifi className="h-3.5 w-3.5 mr-1.5" />
                  Retry connection
                </Button>
              </div>
            </div>
          )}

          {obs.status === "open" && (
            <ObsStreamControl
              canInteract={canInteract}
              isStreaming={obs.isStreaming}
              toggling={obs.togglingStream}
              onToggle={obs.toggleStream}
            />
          )}

          <ObsContainerControl
            canInteract={canInteract}
            flow={flow}
            obsStatus={obs.status}
            containerStatus={containerStatus}
            instanceId={instanceId}
            apiUrl={apiUrl}
            launching={launching}
            launchError={launchError}
            togglingContainer={togglingContainer}
            onLaunch={handleLaunch}
            onToggleContainer={handleToggleContainer}
          />
        </div>
      </div>

      {/* Controls — only meaningful once OBS is actually connected. When it
          isn't, the strip would just be empty shells, so swap the whole thing
          for a single offline/booting state instead. */}
      {obs.status !== "open" ? (
        isStopping ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Stopping your container…</p>
            </CardContent>
          </Card>
        ) : externalStarting ? (
          <ObsOfflineState status="booting" />
        ) : (
          <ObsOfflineState
            status={stripIsOffline ? "offline" : "booting"}
            reason={stopReason ?? "clean"}
            starting={togglingContainer}
            onStart={
              containerStatus !== "running" && canInteract && instanceId && apiUrl
                ? handleToggleContainer
                : undefined
            }
          />
        )
      ) : (
        <div className="space-y-6">
          {/* Scenes — the primary in-stream control, front and center */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Scenes</CardTitle>
            </CardHeader>
            <CardContent>
              {obs.filteredScenes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No scenes found</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {obs.filteredScenes.map((scene) => {
                    const isActive = scene.sceneName === obs.currentScene;
                    const isSwitching = obs.switchingTo === scene.sceneName;
                    return (
                      <Button
                        key={scene.sceneName}
                        variant={isActive ? "default" : "outline"}
                        disabled={isSwitching || obs.switchingTo !== null}
                        onClick={() => obs.switchScene(scene.sceneName)}
                        className="relative"
                      >
                        {isActive && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500 border border-background" />
                        )}
                        {isSwitching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                        {isSwitching ? "Switching…" : scene.sceneName}
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live incoming signal + a shortcut to drop that feed into a scene.
              Key management lives on its own page (/dashboard/irl/ingest); this
              stays here because it needs the live OBS scenes. */}
          <ObsIngestSources
            scenes={obs.scenes}
            currentScene={obs.currentScene}
            canInteract={canInteract}
            onAddToScene={obs.addMediaSourceToScene}
            obsPullHost={obsPullHost}
          />

          {/* Sources / Performance / Files — tabbed so only one dense panel
              is on screen at a time instead of everything stacked and
              fully expanded, which is what made the live view feel noisy. */}
          <Tabs defaultValue="sources">
            <TabsList>
              <TabsTrigger value="sources">
                <Layers className="h-3.5 w-3.5" />
                Sources
              </TabsTrigger>
              <TabsTrigger value="performance">
                <Gauge className="h-3.5 w-3.5" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="files">
                <FolderUp className="h-3.5 w-3.5" />
                Files
              </TabsTrigger>
              <TabsTrigger value="auto-switcher">
                <Repeat className="h-3.5 w-3.5" />
                Auto Switcher
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sources">
              <Card>
                <CardContent className="px-2 pt-4">
                  <ObsSourceProfiler
                    sourceStats={obs.sourceStats}
                    onSetSceneItemEnabled={obs.setSceneItemEnabled}
                    onSetSourceFilterEnabled={obs.setSourceFilterEnabled}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <Card>
                <CardContent className="pt-4">
                  <ObsResourceGraphs obsStats={obs.obsStats} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files">
              <Card>
                <CardContent className="pt-4">
                  <ObsFileUploader
                    apiUrl={apiUrl}
                    instanceId={instanceId}
                    isRunning={containerStatus === "running"}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="auto-switcher">
              <AutoSwitcherTab
                initialConfig={autoSwitcherConfig}
                scenes={obs.filteredScenes}
                sceneItems={obs.sceneItems}
                obsConnected={obs.status === "open"}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
