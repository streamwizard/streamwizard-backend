// The fixed scene/source StreamWizard auto-wires a user's primary ingest key
// into. Fixed names (rather than per-key naming) keep the auto-wire and
// missing-source checks a simple lookup instead of a persisted mapping.
export const IRL_SCENE_NAME = "IRL";
export const IRL_SOURCE_NAME = "StreamWizard Ingest";

// Every StreamWizard Cloud OBS instance ships with this scene pre-built —
// it's meant to be cloned into other scenes as a source (OBS's "Scene" as a
// source), not switched to directly, so it's excluded from the scene picker
// via useObsWebSocket's `_`/`-` prefix filter.
export const ALERTS_SCENE_NAME = "_alerts";

// The default template scene every instance boots with, named as a nudge for
// the user to remove it. Not a real destination for anything, so it's left
// out of scene pickers even though it isn't `_`/`-` prefixed.
export const WELCOME_SCENE_NAME = "Welcome (Delete me)";

/** SRT receiver-buffer latency (ms) for the OBS pull. SRT negotiates the
 * effective TSBPD delay as max(caller, listener), so a value larger than the
 * ingest node's own output listener silently wins and becomes the real one —
 * this must track `INGEST_SRT_EGRESS_LATENCY_MS` in ingest-server (default 300,
 * see apps/ingest-media/src/ingest_media/config.py). That hop is server-to-
 * server over the tailnet (RTT <30ms), so a few hundred ms is plenty; anything
 * more is dead glass-to-glass delay stacked on top of the 4s ingress buffer.
 * Override per environment with NEXT_PUBLIC_OBS_PULL_LATENCY_MS if a node runs
 * a non-default egress latency. */
const DEFAULT_PULL_LATENCY_MS = 300;
export const OBS_PULL_LATENCY_MS =
  Number(process.env.NEXT_PUBLIC_OBS_PULL_LATENCY_MS) || DEFAULT_PULL_LATENCY_MS;

/** The SRT URL an OBS Media Source uses to pull a feed from the ingest server.
 * `host` is the ingest node's tailnet IP, resolved server-side from the linked
 * node and threaded down (see CloudObsPage). */
export function obsPullUrl(host: string, outputKey: string) {
  return `srt://${host}:9000?streamid=${outputKey}&latency=${OBS_PULL_LATENCY_MS}`;
}
