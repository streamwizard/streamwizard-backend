import { toast } from "sonner";
import { buildDemoEvent, type DemoEventType } from "@repo/schemas";
import {
  ALERT_TEST_BROWSER_EVENT,
  type AlertTestBrowserEventDetail,
} from "@repo/ui/overlay";
import { sendTestEventToOverlay } from "@/actions/overlay-test-alert";

/**
 * Where a test event goes. Local stays in this tab: straight into the canvas
 * previews, no server. Live goes out over ws-server, which the editor canvas
 * listens to as well, so the preview and every open overlay see the same event
 * from the same delivery -- no local copy, so nothing fires twice.
 */
export type FireMode = "local" | "live";

export interface DemoFireRequest {
  type: DemoEventType;
  /** Notice type / shape, for events that ship more than one fixture. */
  variant?: string;
  /**
   * An author-edited payload. Left out, Local builds the fixture here and Live
   * lets the server build it, so ids and timestamps stay fresh per fire.
   */
  custom?: Record<string, unknown>;
}

export interface DemoFireContext {
  mode: FireMode;
  sceneId: string;
  /** Local sink for the custom-widget iframes on the canvas. */
  emitLocal: (listener: string, event: Record<string, unknown>) => void;
}

/**
 * The one way a test event reaches an overlay scene. The demo bar's buttons and
 * the alert box's own Test buttons both come through here, so they honour the
 * same Local/Live switch and land in the same places.
 *
 * Returns whether it was delivered. A looping caller needs that: once the
 * server starts rejecting (rate limit, lost connection) every following tick is
 * rejected too, and it should stop rather than toast once a second.
 */
export async function fireDemoEvent(
  { type, variant, custom }: DemoFireRequest,
  { mode, sceneId, emitLocal }: DemoFireContext
): Promise<boolean> {
  if (mode === "local") {
    const payload = custom ?? buildDemoEvent(type, undefined, variant).payload;
    emitLocal(type, payload);
    // Native widgets aren't iframes and have no store to read, so the alert box
    // takes its Local copy off a browser event. Anything that isn't an alert
    // maps to null on the other side and is ignored.
    window.dispatchEvent(
      new CustomEvent<AlertTestBrowserEventDetail>(ALERT_TEST_BROWSER_EVENT, {
        detail: { sceneId, message: { type, payload } },
      })
    );
    return true;
  }

  return sendDemoEventLive({ type, variant, custom });
}

/**
 * Live delivery on its own, for a host with no scene of its own to preview
 * into (the widget editor).
 */
export async function sendDemoEventLive({
  type,
  variant,
  custom,
}: DemoFireRequest): Promise<boolean> {
  const { ok, error } = await sendTestEventToOverlay(type, custom, variant);
  if (!ok) toast.error(error ?? "Could not send the demo event");
  return ok;
}

/** The payload a Local fire would deliver, for a host that posts it itself. */
export function demoFirePayload({
  type,
  variant,
  custom,
}: DemoFireRequest): Record<string, unknown> {
  return custom ?? buildDemoEvent(type, undefined, variant).payload;
}
