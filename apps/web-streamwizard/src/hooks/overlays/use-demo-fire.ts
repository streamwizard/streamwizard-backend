"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import {
  alertInstanceFromSocketMessage,
  alertSkipReason,
  normalizeAlertWidgetConfig,
} from "@repo/ui/overlay";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import {
  demoFirePayload,
  fireDemoEvent,
  type DemoFireRequest,
  type FireMode,
} from "@/components/demo/demo-fire";
import { alertSkipMessage } from "@/components/overlays/widgets/alert/alert-test-feedback";

export interface UseDemoFire {
  mode: FireMode;
  setMode: (mode: FireMode) => void;
  /** Resolves to whether it was delivered. False without a scene, which only happens before the editor has loaded one. */
  fire: (request: DemoFireRequest) => Promise<boolean>;
}

/**
 * Binds the shared test-event path to the scene being edited. The demo bar and
 * the alert box's Test buttons both call this, so one Local/Live switch governs
 * both and neither can deliver somewhere the other doesn't.
 */
export function useDemoFire(): UseDemoFire {
  const sceneId = useOverlayStore((s) => s.scene?.id);
  const items = useOverlayStore((s) => s.scene?.items);
  const mode = useOverlayStore((s) => s.demoFireMode);
  const setMode = useOverlayStore((s) => s.setDemoFireMode);
  const emitLocal = useOverlayStore((s) => s.emitDemoEvent);

  const fire = useCallback(
    async (request: DemoFireRequest) => {
      if (!sceneId) return false;
      const delivered = await fireDemoEvent(request, { mode, sceneId, emitLocal });
      if (delivered) warnIfNoAlertBoxWillPlay(request, items ?? []);
      return delivered;
    },
    [mode, sceneId, items, emitLocal]
  );

  return { mode, setMode, fire };
}

/**
 * A test aimed at a switched-off alert looks exactly like one that never
 * arrived, so say which. Only worth saying when the scene has an alert box at
 * all and every one of them would drop it: if one plays it, the streamer can
 * see that for themselves.
 */
function warnIfNoAlertBoxWillPlay(
  request: DemoFireRequest,
  items: { type: string; config: unknown }[]
): void {
  // Live lets the server rebuild the fixture, so this payload isn't byte-equal
  // to the delivered one. The amounts the gate reads are the same either way.
  const alert = alertInstanceFromSocketMessage({
    type: request.type,
    payload: demoFirePayload(request),
  });
  if (!alert) return;

  const boxes = items.filter((item) => item.type === "alert_widget");
  if (boxes.length === 0) return;

  const gates = boxes.map((box) => {
    const variant = normalizeAlertWidgetConfig(
      box.config as Record<string, unknown>
    ).variants[alert.event];
    return { variant, reason: alertSkipReason(alert, variant) };
  });
  if (gates.some((gate) => !gate.reason)) return;

  const blocking = gates[0];
  if (!blocking.reason) return;
  toast.warning(alertSkipMessage(alert.event, blocking.variant, blocking.reason));
}
