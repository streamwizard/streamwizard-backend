"use client";

import {
  AutoSwitcherForm,
  AutoSwitcherOverrideControls,
  type Scene,
  type SceneItem,
} from "@repo/obs-web";
import { clearSceneOverride, setSceneOverride, upsertAutoSwitcherConfig } from "@/actions/supabase/auto-switcher";
import type { AutoSwitcherConfigRow } from "@repo/supabase/queries/auto-switcher";
import { AutoSwitcherStatusCard } from "./auto-switcher-status-card";
import { useAutoSwitcherStatus } from "@/hooks/obs/use-auto-switcher-status";

interface AutoSwitcherTabProps {
  initialConfig: AutoSwitcherConfigRow | null;
  scenes: Scene[];
  sceneItems: Record<string, SceneItem[]>;
  obsConnected: boolean;
}

export function AutoSwitcherTab({ initialConfig, scenes, sceneItems, obsConnected }: AutoSwitcherTabProps) {
  const { status } = useAutoSwitcherStatus();
  const enabled = initialConfig?.enabled ?? false;

  return (
    <div className="space-y-4">
      <AutoSwitcherStatusCard status={status} enabled={enabled} />
      <AutoSwitcherOverrideControls
        scenes={scenes}
        status={status}
        enabled={enabled}
        onHold={setSceneOverride}
        onRelease={clearSceneOverride}
      />
      <AutoSwitcherForm
        initialConfig={initialConfig}
        scenes={scenes}
        sceneItems={sceneItems}
        obsConnected={obsConnected}
        onSave={upsertAutoSwitcherConfig}
      />
    </div>
  );
}
