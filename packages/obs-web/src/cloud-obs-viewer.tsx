"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, Clipboard as ClipboardIcon, Loader2, MonitorOff, RefreshCw } from "lucide-react";
import { Button, Textarea } from "@repo/ui";

type VncStatus = "connecting" | "connected" | "disconnected" | "error";

const RETRY_DELAY_MS = 3000;
const MAX_AUTO_RETRIES = 30; // ~90 seconds of waiting

// getConnection mints a fresh single-use ws-ticket (plus the VNC password
// x11vnc now requires) and returns the full WS URL. It's called once per
// connection attempt (including every retry) because a ticket can't be
// reused -- see lib/ws-ticket.ts's mintNoVncConnection.
export function CloudOBSViewer({ getConnection }: { getConnection: () => Promise<{ url: string; password: string }> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<VncStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  // Retry count lives in a ref, not state: it has to survive the effect re-runs
  // that each retry triggers, and we mutate it from inside an event handler
  // rather than a setState updater (updaters must stay pure -- the old code
  // scheduled the retry timer inside one, which double-fired under StrictMode).
  const retryCountRef = useRef(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clipboard sync state. Survives reconnects on purpose: lastSent stops the
  // same local text being re-pasted to the server on every focus/reconnect
  // (and stops remote text echoing straight back), pendingWrite holds a remote
  // clipboard update that navigator.clipboard.writeText rejected while the
  // document was unfocused, and rfbRef lets the manual clipboard panel send
  // outside the connection effect.
  const rfbRef = useRef<import("@novnc/novnc").default | null>(null);
  const lastSentRef = useRef("");
  const pendingWriteRef = useRef<string | null>(null);
  const [clipboardOpen, setClipboardOpen] = useState(false);
  const [clipboardDraft, setClipboardDraft] = useState("");

  // When the tab is backgrounded the browser throttles requestAnimationFrame,
  // so noVNC stops painting -- but the socket keeps streaming full-desktop OBS
  // frames into its render queue, which then grows without bound (the "10 GB
  // over time" leak). Track visibility and drop the connection while hidden.
  const [visible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);

  useEffect(() => {
    const onVisibility = () => {
      const isVisible = !document.hidden;
      if (isVisible) retryCountRef.current = 0; // give a backgrounded-then-reopened tab a full retry budget
      setVisible(isVisible);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    // While hidden we deliberately hold no socket; the previous run's cleanup
    // has already disconnected. Reconnect happens when `visible` flips back.
    if (!visible) return;

    const container = containerRef.current;
    if (!container) return;

    let rfb: import("@novnc/novnc").default | undefined;
    let cancelled = false;
    let wasConnected = false;
    let isConnected = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let focusRetryTimer: ReturnType<typeof setTimeout> | null = null;

    setStatus("connecting");
    setErrorMessage(null);

    // Pushes the local clipboard to the server. Only meaningful once the RFB
    // session is connected (noVNC silently drops pastes before that), and
    // readText demands a focused document -- both are also why this runs again
    // on "connect", not just on focus events.
    const pushLocalClipboard = () => {
      if (!isConnected || !document.hasFocus()) return;

      // First flush a remote clipboard update that writeText rejected while
      // the document was unfocused.
      const pending = pendingWriteRef.current;
      if (pending !== null) {
        navigator.clipboard
          .writeText(pending)
          .then(() => {
            if (pendingWriteRef.current === pending) pendingWriteRef.current = null;
          })
          .catch((err) => console.debug("[cloud-obs] clipboard write failed", err));
      }

      navigator.clipboard
        .readText()
        .then((text) => {
          if (!text || text === lastSentRef.current) return;
          lastSentRef.current = text;
          rfb?.clipboardPasteFrom(text);
        })
        // Rejects on Firefox (readText isn't exposed to pages), Safari (needs
        // a user gesture) and Chromium mid focus-transition. The clipboard
        // panel is the manual fallback for all of those.
        .catch((err) => console.debug("[cloud-obs] clipboard read failed", err));
    };

    Promise.all([import("@novnc/novnc"), getConnection()]).then(([{ default: RFB }, { url, password }]) => {
      if (cancelled) return;

      rfb = new RFB(container, url, { credentials: { password } });
      rfb.scaleViewport = true;
      rfb.resizeSession = false;
      rfbRef.current = rfb;

      rfb.addEventListener("connect", () => {
        if (cancelled) return;
        wasConnected = true;
        isConnected = true;
        setStatus("connected");
        retryCountRef.current = 0;
        // Deliver whatever was copied before/while the connection came up --
        // focus events fired during connect were no-ops.
        pushLocalClipboard();
      });

      rfb.addEventListener("disconnect", (event: Event) => {
        if (cancelled) return;
        isConnected = false;

        if (wasConnected) {
          setStatus("disconnected");
          return;
        }

        // Before we ever connect, both clean and unclean closes mean the VNC
        // port isn't ready yet (the proxy closes uncleanly when it can't reach
        // the container). Auto-retry until MAX_AUTO_RETRIES before giving up.
        retryCountRef.current += 1;
        if (retryCountRef.current >= MAX_AUTO_RETRIES) {
          setStatus("error");
          setErrorMessage("OBS didn't start in time. The instance may have crashed.");
          return;
        }
        retryTimer = setTimeout(() => {
          if (!cancelled) setAttempt((a) => a + 1);
        }, RETRY_DELAY_MS);
      });

      rfb.addEventListener("securityfailure", (event: Event) => {
        if (cancelled) return;
        const { reason } = (event as CustomEvent<{ reason?: string }>).detail;
        setStatus("error");
        setErrorMessage(reason ?? "Authentication failed.");
      });

      rfb.addEventListener("clipboard", (event: Event) => {
        if (cancelled) return;
        const text = (event as CustomEvent<{ text: string }>).detail.text;
        // Mirror it into the manual panel, and mark it as already-sent so the
        // next focus push doesn't echo it straight back to the server.
        lastSentRef.current = text;
        setClipboardDraft(text);
        navigator.clipboard.writeText(text).catch((err) => {
          // Usually NotAllowedError because the document isn't focused (copy
          // in OBS, then switch away). Retried on the next focus; the panel
          // has the text either way.
          pendingWriteRef.current = text;
          console.debug("[cloud-obs] clipboard write failed", err);
        });
      });
    }).catch(() => {
      if (cancelled) return;
      setStatus("error");
      setErrorMessage("Couldn't get a connection ticket. Please try again.");
    });

    const onFocusGained = () => {
      pushLocalClipboard();
      // readText can still reject right at the focus transition ("Document is
      // not focused"); one delayed retry after focus settles. Dedupe via
      // lastSentRef keeps this from double-sending.
      if (focusRetryTimer) clearTimeout(focusRetryTimer);
      focusRetryTimer = setTimeout(pushLocalClipboard, 150);
    };
    container.addEventListener("focusin", onFocusGained);
    window.addEventListener("focus", onFocusGained);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (focusRetryTimer) clearTimeout(focusRetryTimer);
      container.removeEventListener("focusin", onFocusGained);
      window.removeEventListener("focus", onFocusGained);
      rfbRef.current = null;
      rfb?.disconnect();
    };
    // `attempt` is intentionally included so incrementing it re-runs this effect
    // and creates a fresh RFB connection (used for both auto-retry and manual
    // retry). `visible` re-runs it to drop/restore the socket on tab visibility.
  }, [getConnection, attempt, visible]);

  const handleManualRetry = () => {
    retryCountRef.current = 0;
    setAttempt((a) => a + 1);
  };

  // Manual clipboard path: works everywhere the automatic navigator.clipboard
  // sync can't (Firefox has no page readText, Safari wants a user gesture) --
  // a native paste into the textarea is itself the gesture.
  const handleClipboardDraftChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    setClipboardDraft(text);
    lastSentRef.current = text;
    rfbRef.current?.clipboardPasteFrom(text);
  };

  return (
    <div className="relative h-full w-full">
      {/* noVNC mounts its canvas here — always in the DOM so RFB has a stable target */}
      <div ref={containerRef} className="h-full w-full" />

      {visible && status === "connected" && (
        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 bg-black/60 text-white hover:bg-black/80"
            onClick={() => setClipboardOpen((open) => !open)}
            title="Clipboard"
          >
            <ClipboardIcon className="h-3.5 w-3.5" />
          </Button>
          {clipboardOpen && (
            <div className="w-72 rounded-md border border-white/10 bg-black/90 p-3 backdrop-blur-sm">
              <p className="text-xs font-medium text-white">Clipboard</p>
              <p className="mt-1 text-xs text-white/40">
                Paste here to send text to OBS. Anything copied inside OBS shows up here too.
              </p>
              <Textarea
                value={clipboardDraft}
                onChange={handleClipboardDraftChange}
                rows={4}
                spellCheck={false}
                className="mt-2 border-white/10 bg-white/5 text-xs text-white"
              />
            </div>
          )}
        </div>
      )}

      {!visible && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 backdrop-blur-sm">
          <MonitorOff className="h-7 w-7 text-white/40" />
          <p className="text-sm font-medium text-white">Paused while this tab is in the background.</p>
          <p className="text-xs text-white/40">Switch back to reconnect.</p>
        </div>
      )}

      {visible && status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 backdrop-blur-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
            <Loader2 className="h-7 w-7 animate-spin text-white/60" />
          </div>
          <p className="text-sm font-medium text-white">OBS is starting up.</p>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/30"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {visible && status === "disconnected" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/95 backdrop-blur-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
            <MonitorOff className="h-7 w-7 text-white/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">OBS stopped.</p>
            <p className="mt-1 text-xs text-white/40">The instance was shut down.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => window.close()}>
              Close
            </Button>
            <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={handleManualRetry}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Reconnect
            </Button>
          </div>
        </div>
      )}

      {visible && status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/95 backdrop-blur-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Couldn&apos;t connect.</p>
            {errorMessage && <p className="mt-1 max-w-xs text-xs text-white/40">{errorMessage}</p>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => window.close()}>
              Close
            </Button>
            <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={handleManualRetry}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
