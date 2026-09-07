"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@repo/ui";
import { AutoSwitcherForm, AutoSwitcherOverrideControls, mintWsUrl, useObsWebSocket } from "@repo/obs-web";
import type { AutoSwitcherFormValues } from "@repo/schemas";
import { getInstanceObsWsPasswordAdminAction } from "@/actions/nodes";
import { clearSceneOverrideForUser, setSceneOverrideForUser, upsertAutoSwitcherConfigForUser } from "@/actions/auto-switcher";
import type { AutoSwitcherConfigRow } from "@repo/supabase/queries/auto-switcher";

interface InstanceSwitcherTabProps {
  /** Owner of the config — the instance's user. */
  userId: string;
  instanceId: string;
  apiUrl: string | null;
  instanceRunning: boolean;
  initialConfig: AutoSwitcherConfigRow | null;
}

// Admin view of a user's auto-switcher settings. Scene pickers ride an obsws
// session opened through the node's admin proxy — they only populate while the
// instance is running; the form itself works either way (uuids are stored).
export function InstanceSwitcherTab({ userId, instanceId, apiUrl, instanceRunning, initialConfig }: InstanceSwitcherTabProps) {
  const [obsWsPassword, setObsWsPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!instanceRunning || !apiUrl) return;
    getInstanceObsWsPasswordAdminAction(instanceId).then(({ data }) => {
      if (data) setObsWsPassword(data.password);
    });
  }, [instanceId, instanceRunning, apiUrl]);

  const getWsUrl = useCallback(() => {
    if (!apiUrl) return Promise.reject(new Error("Node has no API URL."));
    return mintWsUrl(apiUrl, {
      ticketPath: `/admin/instances/${instanceId}/ws-ticket`,
      wsPath: `/admin/instances/${instanceId}/obsws`,
      scope: "obsws",
    });
  }, [apiUrl, instanceId]);

  const obs = useObsWebSocket({
    getWsUrl: instanceRunning && apiUrl && obsWsPassword ? getWsUrl : null,
    password: obsWsPassword,
  });

  const obsConnected = obs.status === "open";
  const enabled = initialConfig?.enabled ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={obsConnected ? "default" : "outline"}>{obsConnected ? "OBS connected" : "OBS offline"}</Badge>
        {!obsConnected && (
          <span>
            Scene pickers need the instance&apos;s OBS running — saved scene names still show below.
          </span>
        )}
      </div>
      <AutoSwitcherOverrideControls
        scenes={obs.scenes}
        status={null}
        enabled={enabled}
        onHold={(sceneUuid, sceneName, durationMinutes) =>
          setSceneOverrideForUser(userId, sceneUuid, sceneName, durationMinutes)
        }
        onRelease={() => clearSceneOverrideForUser(userId)}
      />
      <AutoSwitcherForm
        initialConfig={initialConfig}
        scenes={obs.scenes}
        sceneItems={obs.sceneItems}
        obsConnected={obsConnected}
        onSave={(values: AutoSwitcherFormValues) => upsertAutoSwitcherConfigForUser(userId, values)}
      />
    </div>
  );
}
