"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  cn,
} from "@repo/ui";
import { AlertTriangle, Loader2, MonitorOff, Radio, Square, Wifi, WifiOff } from "lucide-react";
import { getMyLatestInstanceAction } from "@/actions/nodes";
import { setSceneOverride } from "@/actions/supabase/auto-switcher";
import type { AutoSwitcherConfigRow } from "@repo/supabase/queries/auto-switcher";
import { toggleInstance } from "@/lib/instance-actions";
import type { Scene } from "@repo/obs-web";
import { useObsInstanceSession } from "@/hooks/obs/use-obs-instance-session";
import { useObsReconnectOnWake } from "@/hooks/obs/use-obs-reconnect-on-wake";
import { useDeckTabs } from "@/hooks/deck/use-deck-tabs";
import { ObsBootProgress } from "@/components/irl/obs-boot-progress";
import { ObsOfflineState } from "@/components/irl/obs-offline-state";
import { ObsLifecycleBanner } from "@/components/irl/obs-lifecycle-banner";
import { FeatureDisabledBanner } from "@/components/ui/feature-disabled-banner";
import { AutoSwitcherHoldCard } from "@/components/deck/auto-switcher-hold-card";
import { InstallPrompt } from "@/components/deck/install-prompt";
import { DeckFooter, deckChatPadding, deckMainPadding } from "@/components/deck/deck-tab-bar";
import { SwitcherSettingsPanel } from "@/components/deck/switcher-settings-panel";
import { DeckChatPanel } from "@/components/deck/chat/deck-chat-panel";
import { DeckStreamPanel } from "@/components/deck/stream-info/deck-stream-panel";
import { useDeckChatRoom } from "@/hooks/deck/use-deck-chat-room";

interface DeckContentProps {
  canInteract: boolean;
  /** Full config row, so the switcher tab can edit it and the deck can gate scene holds on it. */
  autoSwitcherConfig: AutoSwitcherConfigRow | null;
  initialOverride: { sceneName: string | null } | null;
  /** Null when the Twitch integration is missing; chat then reads empty and can't send. */
  broadcasterUserId: string | null;
  broadcasterUserName: string | null;
}

// Tall touch targets: an IRL streamer is tapping this one-handed on a phone
// while walking, so every actionable button gets the same oversized shape.
const deckButtonClass = "h-24 rounded-2xl text-base font-semibold";

export function DeckContent({
  canInteract,
  autoSwitcherConfig,
  initialOverride,
  broadcasterUserId,
  broadcasterUserName,
}: DeckContentProps) {
  // Config lives in state, not as a frozen prop: saving on the switcher tab must
  // immediately change whether a scene tap holds the scene, without a reload.
  const [switcherConfig, setSwitcherConfig] = useState(autoSwitcherConfig);
  const switcherEnabled = switcherConfig?.enabled ?? false;

  const {
    tab,
    handleTabChange,
    goToTab,
    saveBar,
    setSaveBar,
    saveBarActionsRef,
    discardPrompt,
    setDiscardPrompt,
  } = useDeckTabs();

  // Mounted here rather than inside the chat panel so switching tabs neither
  // drops the buffered messages nor churns the websocket connection.
  const chatRoom = useDeckChatRoom();

  // True from a deck-initiated container start until OBS connects; gates the
  // boot stepper so plain websocket reconnects don't look like OBS restarting.
  const [startRequested, setStartRequested] = useState(false);
  const [togglingContainer, setTogglingContainer] = useState(false);
  const [bootElapsed, setBootElapsed] = useState(0);
  // Last override state the deck knows about (scene name held, or null), plus
  // when the deck last changed it. The hold card prefers the engine's live
  // status frames; these cover the gap right after a tap and ws-down fallback.
  const [heldScene, setHeldScene] = useState<string | null>(initialOverride?.sceneName ?? null);
  const [heldAt, setHeldAt] = useState(0);

  const {
    instanceId,
    apiUrl,
    containerStatus,
    setContainerStatus,
    loadError,
    obs,
    awaitingConnectRef,
    selfInitiatedRef,
    stopReason,
    clearStopReason,
    setStopReason,
    transition,
  } = useObsInstanceSession({
    // A crash mid-launch must clear the boot flag, or the stepper spins on
    // "spinning up your container" forever.
    onStopped: () => setStartRequested(false),
  });

  const handleStart = async () => {
    if (!apiUrl || !instanceId) return;
    setTogglingContainer(true);
    // Our own start: suppress the external toast for the "started" it produces,
    // and clear any crash banner we're recovering from.
    selfInitiatedRef.current = true;
    clearStopReason();
    try {
      await toggleInstance(apiUrl, instanceId, "start");
      setContainerStatus("running");
      setStartRequested(true);
      awaitingConnectRef.current = true;
      // reconnect (not connect) resets the retry budget, so a restart after a
      // previous boot timeout will actually retry instead of giving up at once.
      obs.reconnect();
      toast.success("Starting your container", { description: "OBS is booting up." });
    } catch (err) {
      toast.error("Couldn't start the container", {
        description: err instanceof Error ? err.message : "Try again?",
      });
    } finally {
      setTogglingContainer(false);
    }
  };

  const handleSceneSwitch = (scene: Scene) => {
    // Switch immediately; don't wait on the override round-trip.
    obs.switchScene(scene.sceneName).catch((err) => {
      toast.error("Couldn't switch the scene", { description: err instanceof Error ? err.message : "Try again?" });
    });

    if (!switcherEnabled) return;
    // Hold the scene so the auto switcher doesn't take it back (or force the
    // connection-lost scene when the feed drops). If the engine flips the
    // scene inside the ~1s push window, it re-switches to the held scene the
    // moment the override lands.
    setSceneOverride(scene.sceneUuid, scene.sceneName, null)
      .then((result) => {
        if (result.ok) {
          setHeldScene(scene.sceneName);
          setHeldAt(Date.now());
        } else {
          toast.warning("Scene switched, but the hold didn't stick", {
            description: result.error ?? "The auto switcher may switch back. Tap the scene again.",
          });
        }
      })
      .catch((err) => {
        toast.warning("Scene switched, but the hold didn't stick", {
          description: err instanceof Error ? err.message : "The auto switcher may switch back. Tap the scene again.",
        });
      });
  };

  const handleHoldReleased = () => {
    setHeldScene(null);
    setHeldAt(Date.now());
  };

  // The boot stepper is only honest after the user actually started the
  // container from this page. Every other connect (page load onto a running
  // box, waking the phone, network change) is just the websocket coming back,
  // so it gets a plain "Connecting" state instead of "Booting OBS".
  if (obs.status === "open" && startRequested) {
    setStartRequested(false);
  }

  // Start flow phases -- starting (start request in flight), booting (container
  // up after a deck start, OBS WS connecting/retrying), connected, or timed out.
  const isStarting = togglingContainer && containerStatus !== "running";
  const connectingLike = obs.status === "connecting" || obs.isAutoRetrying;
  const isBooting =
    !isStarting && startRequested && containerStatus === "running" && obs.status !== "open" && !obs.hasTimedOut && connectingLike;
  const isReconnecting =
    !isStarting && !startRequested && containerStatus === "running" && obs.status !== "open" && !obs.hasTimedOut && connectingLike;
  const inStartFlow = isStarting || isBooting;
  const hasTimedOut = containerStatus === "running" && obs.hasTimedOut && obs.status !== "open";
  const hasNoInstance = containerStatus === "stopped" && !instanceId;
  const crashed = containerStatus === "stopped" && stopReason === "crashed";
  // Transitional states pushed from other devices/admin. The local actor sees
  // its own flow (inStartFlow); these cover the "someone else did it" case so a
  // deliberate stop reads "Stopping…", not a misleading reconnect spinner.
  const isStopping = transition === "stopping" && obs.status !== "open";
  const externalStarting = transition === "starting" && !inStartFlow && obs.status !== "open";

  // Reset the elapsed counter on the flow edges during render (the React-blessed
  // adjust-state-on-change pattern); the interval below only ever counts up.
  const [flowActive, setFlowActive] = useState(false);
  if (inStartFlow !== flowActive) {
    setFlowActive(inStartFlow);
    setBootElapsed(0);
  }

  // Single elapsed timer spanning the whole start flow. Keyed on the boolean so
  // it runs continuously across starting -> booting.
  useEffect(() => {
    if (!inStartFlow) return;
    const start = Date.now();
    const id = setInterval(() => setBootElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [inStartFlow]);

  useEffect(() => {
    if (obs.status === "open" && awaitingConnectRef.current) {
      awaitingConnectRef.current = false;
      toast.success("OBS connected", { description: "You're ready to go live." });
    }
  }, [obs.status]);

  useObsReconnectOnWake({
    instanceId,
    apiUrl,
    containerStatus,
    setContainerStatus,
    setStopReason,
    obsStatus: obs.status,
    reconnect: obs.reconnect,
    disconnect: obs.disconnect,
  });

  const statusVariant =
    obs.status === "open"
      ? "default"
      : hasTimedOut || crashed
      ? "destructive"
      : inStartFlow || isReconnecting || isStopping || externalStarting
      ? "secondary"
      : "outline";

  // Any tab may own unsaved changes; only one is mounted at a time, so whatever
  // reported a save bar is the tab on screen.
  const showSaveBar = saveBar != null && (saveBar.dirty || saveBar.submitting);
  // Chat is the one tab that owns the viewport instead of scrolling inside it:
  // its message list is the scroller, and the composer has to stay put above
  // the tab bar while the list moves under it.
  const isChat = tab === "chat";

  return (
    <main
      className={cn(
        "bg-background px-4 pt-6 select-none [touch-action:manipulation]",
        isChat ? cn("flex h-dvh flex-col overflow-hidden", deckChatPadding) : cn("min-h-dvh", deckMainPadding(showSaveBar)),
      )}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-md",
          isChat ? "flex min-h-0 flex-1 flex-col gap-3" : "space-y-4",
        )}
      >
        {!canInteract && <FeatureDisabledBanner />}

        {/* High-signal banner for events the streamer can't afford to miss: a
            crash (stream just dropped) or a delete. */}
        <ObsLifecycleBanner
          reason={stopReason}
          onRestart={canInteract && instanceId && apiUrl ? handleStart : undefined}
          restarting={togglingContainer}
          onDismiss={clearStopReason}
        />

        {/* Title + connection status. The OBS badge stays on both tabs so the
            connection state is never a tab switch away. */}
        <div className="flex shrink-0 items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">
            {tab === "switcher"
              ? "Sensitivity"
              : tab === "stream"
                ? "Stream info"
                : isChat
                  ? "Chat"
                  : "Stream Deck"}
          </h1>
          <Badge variant={statusVariant} className="gap-1.5">
            {obs.status === "open" && <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block animate-pulse" />}
            {(inStartFlow || isReconnecting || isStopping || externalStarting) && <Loader2 className="h-3 w-3 animate-spin" />}
            {(hasTimedOut || crashed) && <AlertTriangle className="h-3 w-3" />}
            {!inStartFlow && !isReconnecting && !isStopping && !externalStarting && !hasTimedOut && !crashed && obs.status === "closed" && (
              <WifiOff className="h-3 w-3" />
            )}
            {obs.status === "open"
              ? "OBS Connected"
              : crashed
              ? "Crashed"
              : hasTimedOut
              ? "Not responding"
              : isStopping
              ? "Stopping…"
              : isStarting || externalStarting
              ? "Starting up…"
              : isBooting
              ? "OBS booting…"
              : isReconnecting
              ? "Connecting…"
              : containerStatus === "running"
              ? "Disconnected"
              : "Offline"}
          </Badge>
        </div>

        {isChat ? (
          <DeckChatPanel
            room={chatRoom}
            broadcasterUserId={broadcasterUserId}
            broadcasterUserName={broadcasterUserName}
            broadcasterUserLogin={broadcasterUserName?.toLowerCase() ?? null}
            canSend={broadcasterUserId != null}
          />
        ) : tab === "stream" ? (
          <DeckStreamPanel
            broadcasterId={broadcasterUserId}
            canInteract={canInteract}
            onSaveBarChange={setSaveBar}
            actionsRef={saveBarActionsRef}
          />
        ) : tab === "switcher" ? (
          <SwitcherSettingsPanel
            config={switcherConfig}
            canInteract={canInteract}
            onSaved={setSwitcherConfig}
            onSaveBarChange={setSaveBar}
            actionsRef={saveBarActionsRef}
          />
        ) : loadError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-sm">{loadError}</p>
            </CardContent>
          </Card>
        ) : containerStatus === "unknown" ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : isStopping ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Stopping your container…</p>
            </CardContent>
          </Card>
        ) : externalStarting ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Starting your container…</p>
            </CardContent>
          </Card>
        ) : hasNoInstance ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MonitorOff className="h-6 w-6 text-muted-foreground" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium">No Cloud OBS yet</p>
                <p className="text-sm text-muted-foreground">Set it up from the dashboard first. The deck takes over from there.</p>
              </div>
              <Button size="sm" asChild>
                <Link href="/dashboard/irl/obs">Go to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : inStartFlow ? (
          <ObsBootProgress phase={isStarting ? "provisioning" : "booting"} elapsedSeconds={bootElapsed} />
        ) : isReconnecting ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Connecting to OBS…</p>
            </CardContent>
          </Card>
        ) : hasTimedOut ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-sm">OBS never came online. Your container is running, but we can&apos;t reach OBS inside it.</p>
              <Button variant="outline" className={cn(deckButtonClass, "w-full")} onClick={obs.reconnect}>
                <Wifi className="h-4 w-4 mr-2" />
                Retry connection
              </Button>
            </CardContent>
          </Card>
        ) : containerStatus === "stopped" ? (
          <ObsOfflineState
            status="offline"
            reason={stopReason ?? "clean"}
            starting={togglingContainer}
            onStart={canInteract && instanceId && apiUrl ? handleStart : undefined}
          />
        ) : obs.status !== "open" ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <WifiOff className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm">Lost the connection to OBS.</p>
              <Button variant="outline" className={cn(deckButtonClass, "w-full")} onClick={obs.reconnect} disabled={!apiUrl || !instanceId}>
                <Wifi className="h-4 w-4 mr-2" />
                Reconnect
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stream toggle */}
            <Button
              variant={obs.isStreaming ? "destructive" : "default"}
              disabled={!canInteract || obs.togglingStream}
              onClick={obs.toggleStream}
              className={cn(deckButtonClass, "w-full")}
            >
              {obs.togglingStream ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : obs.isStreaming ? (
                <Square className="h-4 w-4 mr-2" />
              ) : (
                <Radio className="h-4 w-4 mr-2" />
              )}
              {obs.togglingStream ? "Working…" : obs.isStreaming ? "End stream" : "Go live"}
            </Button>

            {/* Current scene */}
            <Card>
              <CardContent className="space-y-1 py-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current scene</p>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500 animate-pulse" />
                  <p className="truncate text-lg font-semibold text-primary">{obs.currentScene ?? "—"}</p>
                </div>
                {obs.sceneChangedAt && (
                  <p className="text-xs tabular-nums text-muted-foreground">Updated {obs.sceneChangedAt.toLocaleTimeString()}</p>
                )}
              </CardContent>
            </Card>

            {/* Auto switcher hold state */}
            <AutoSwitcherHoldCard
              enabled={switcherEnabled}
              canInteract={canInteract}
              heldScene={heldScene}
              heldAt={heldAt}
              onReleased={handleHoldReleased}
            />

            {/* Scenes */}
            {obs.filteredScenes.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No scenes found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {obs.filteredScenes.map((scene) => {
                  const isActive = scene.sceneName === obs.currentScene;
                  const isSwitching = obs.switchingTo === scene.sceneName;
                  return (
                    <Button
                      key={scene.sceneUuid}
                      variant={isActive ? "default" : "outline"}
                      disabled={obs.switchingTo !== null}
                      onClick={() => handleSceneSwitch(scene)}
                      className={cn(deckButtonClass, "relative")}
                    >
                      {isActive && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-500 border border-background" />}
                      {isSwitching && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      <span className="truncate">{isSwitching ? "Switching…" : scene.sceneName}</span>
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Stream status footer */}
            <Card>
              <CardContent className="flex items-center justify-between py-3">
                <p className="text-sm text-muted-foreground">Stream</p>
                <div className={cn("flex items-center gap-1.5 text-sm font-medium", obs.isStreaming ? "text-red-400" : "text-muted-foreground")}>
                  <Radio className={cn("h-3.5 w-3.5", obs.isStreaming && "animate-pulse")} />
                  {obs.isStreaming ? "Live" : "Offline"}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* The chat tab has no spare vertical space to offer it. */}
        {isChat ? null : <InstallPrompt />}
      </div>

      <DeckFooter
        tab={tab}
        onTabChange={handleTabChange}
        saveBar={saveBar}
        onSave={() => saveBarActionsRef.current?.save()}
        onDiscard={() => saveBarActionsRef.current?.discard()}
        chatUnread={chatRoom.unreadEvents > 0}
      />

      <AlertDialog open={discardPrompt !== null} onOpenChange={(open) => !open && setDiscardPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You changed some settings but never saved them. Leaving now throws them away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const next = discardPrompt;
                saveBarActionsRef.current?.discard();
                setDiscardPrompt(null);
                if (next) goToTab(next);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
