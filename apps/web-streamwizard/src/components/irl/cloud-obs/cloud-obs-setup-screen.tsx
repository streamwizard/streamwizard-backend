"use client";

import type { IngestStreamKey } from "@/actions/ingest-keys";
import { FeatureDisabledBanner } from "@/components/ui/feature-disabled-banner";
import { ObsSetupStepper } from "@/components/irl/obs-setup-stepper";
import { ObsVncPreview } from "@/components/irl/obs-vnc-preview";
import { ALERTS_SCENE_NAME } from "@/lib/obs-irl";
import type { useObsWebSocket } from "@repo/obs-web";
import type { ObsFlowState } from "@/components/irl/cloud-obs/obs-flow-state";
import { ObsSetupStatusBadge } from "@/components/irl/cloud-obs/obs-status-badge";

type ObsConnection = ReturnType<typeof useObsWebSocket>;

/**
 * First-run screen: the guided stepper that walks a streamer from "no ingest
 * key, no container" to "OBS open with their feed wired in". Shown until they
 * finish or skip the last step — see `onboardingFlow` in the page component.
 */
export function CloudObsSetupScreen({
  canInteract,
  flow,
  obs,
  instanceId,
  containerStatus,
  ingestKeys,
  launching,
  launchError,
  togglingContainer,
  hasOpenedViewer,
  onKeyCreated,
  onLaunch,
  onStartContainer,
  onOpenViewer,
  onFinishSetup,
}: {
  canInteract: boolean;
  flow: ObsFlowState;
  obs: ObsConnection;
  instanceId: string | null;
  containerStatus: "running" | "stopped" | "unknown";
  ingestKeys: IngestStreamKey[];
  launching: boolean;
  launchError: string | null;
  togglingContainer: boolean;
  hasOpenedViewer: boolean;
  onKeyCreated: (key: IngestStreamKey) => void;
  onLaunch: () => void;
  onStartContainer: () => void;
  onOpenViewer: () => void;
  onFinishSetup: () => void;
}) {
  return (
    <div className="w-full space-y-6">
      {!canInteract && <FeatureDisabledBanner />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <ObsVncPreview
          instanceId={instanceId}
          status={obs.status === "open" ? "connected" : flow.inLaunchFlow ? "booting" : "offline"}
          onOpen={onOpenViewer}
        />
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Cloud OBS</h2>
            <ObsSetupStatusBadge obsOpen={obs.status === "open"} flow={flow} />
          </div>
          <ObsSetupStepper
            canInteract={canInteract}
            hasKey={ingestKeys.length > 0}
            onKeyCreated={onKeyCreated}
            instanceId={instanceId}
            containerStatus={containerStatus}
            launching={launching}
            togglingContainer={togglingContainer}
            launchError={launchError}
            onLaunch={onLaunch}
            onStartContainer={onStartContainer}
            obsStatus={obs.status}
            isBooting={flow.isBooting}
            hasTimedOut={flow.hasTimedOut}
            onReconnect={obs.reconnect}
            hasOpenedViewer={hasOpenedViewer}
            onOpenViewer={onOpenViewer}
            scenes={obs.filteredScenes}
            alertSceneItems={obs.sceneItems[ALERTS_SCENE_NAME] ?? []}
            onAddAlertSource={obs.addBrowserSourceToScene}
            onAddAlertSourceClone={obs.addSourceCloneToScene}
            onFinishSetup={onFinishSetup}
          />
        </div>
      </div>
    </div>
  );
}
