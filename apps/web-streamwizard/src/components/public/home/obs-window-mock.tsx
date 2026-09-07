"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { cn } from "@repo/ui";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Lock,
  MoreVertical,
  Plus,
  RotateCw,
  Settings2,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { DEMO_SCENES, sceneVideoUrl, type DemoScene } from "./obs-demo-data";
import {
  BrbOverlay,
  CLOCK_START,
  ClockWidget,
  ConnectionLostOverlay,
  EndingOverlay,
  StartingSoonOverlay,
  useOverlayTick,
} from "./away-overlays";
import { OverlayLiveChat } from "./overlay-live-chat";
import { handoffKey, useCurrentScene, useObsDemo } from "./obs-demo-store";
import { useDemoTracking } from "../analytics/use-demo-tracking";

/*
 * The cloud OBS window, rebuilt from the screenshot in the docs
 * (irl/onboarding-07-obs-viewer.png) as a component so visitors can poke at it:
 * pick a scene, start the stream, flip studio mode. It sits in a browser frame
 * because that is where it really lives — /obs-viewer, no install anywhere.
 *
 * Colours are sampled straight from that screenshot, so this reads as the same
 * window rather than as a themed approximation of it. It is a drawing, not a
 * client: no OBS websocket, nothing to break when the real one changes. The
 * scene and stream state come from the section's shared store, so this window
 * and the mobile deck beside it move together.
 *
 * Below `sm` the three OBS columns do not fit, so the docks reflow: preview on
 * top at full width, then scenes, sources and controls side by side, then the
 * mixer row. The two column wrappers become `display: contents` there so their
 * docks can be placed on one grid with `order`; from `sm` up they are the
 * columns again and the window reads like the screenshot.
 */

// OBS's Yami dark theme, sampled from the screenshot.
const CHROME = "#282828";
const PANEL = "#272a33";
const SURFACE = "#1d1f26";
const RAISED = "#3c404d";
const SELECTED = "#284db8";

const MENUS = ["File", "Edit", "View", "Docks", "Profile", "Scene Collection", "Tools", "Help"];

function clock(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((part) => String(part).padStart(2, "0")).join(":");
}

/** A dock header bar: title on the left, the float/close affordance on the right. */
function DockHeader({ title }: { title: string }) {
  return (
    <div
      className="flex shrink-0 items-center justify-between px-2 py-1 text-[10px] font-medium text-[#c7ccd8]"
      style={{ background: RAISED }}
    >
      {title}
      <span className="text-[#8b91a1]">▣</span>
    </div>
  );
}

/** The row of icon buttons along the bottom of the scenes and sources docks. */
function DockToolbar({ extra }: { extra?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-black/40 px-2 py-1 text-[#9aa1b2]">
      <Plus className="h-3 w-3" />
      <Trash2 className="h-3 w-3" />
      {extra ? <Settings2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      <span className="ml-auto flex items-center gap-2">
        <span className="text-[9px] leading-none">▲</span>
        <span className="text-[9px] leading-none">▼</span>
      </span>
    </div>
  );
}

/**
 * A scene's real clip from the CDN, laid over whatever that scene draws. The
 * drawing shows until the first frame arrives and takes over for good if the
 * clip fails to load, so a scene with no clip (or a missing upload) still has
 * a preview. The clip only plays while the window is on screen, so the page
 * does not keep decoding video nobody can see.
 */
function SceneClip({ scene, active }: { scene: string; active: boolean }) {
  const src = sceneVideoUrl(scene);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      // Muted autoplay is allowed everywhere; the catch is for the odd browser
      // that still says no, where the drawn scene is the whole preview.
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [active]);

  if (!src || failed) return null;

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      loop
      playsInline
      autoPlay={active}
      preload={active ? "auto" : "metadata"}
      onError={() => setFailed(true)}
      aria-hidden
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

/** The IRL scene: the incoming feed, over the drawn evening-street gradient. */
function IrlPreview({ active }: { active: boolean }) {
  return (
    <div className="relative h-full w-full bg-[linear-gradient(160deg,#1b2440_0%,#2a1c3d_55%,#12161f_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_35%,rgba(158,122,255,0.35),transparent_60%)]" />
      <SceneClip scene="IRL" active={active} />
      <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[9px] text-white/90">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        IRL CAM
      </div>
      <div className="absolute right-2 bottom-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] tabular-nums text-white/80">
        SRT · 6200 kbps
      </div>
    </div>
  );
}

const AWAY_OVERLAYS = {
  starting: StartingSoonOverlay,
  brb: BrbOverlay,
  ending: EndingOverlay,
  lost: ConnectionLostOverlay,
};

/**
 * The away screens are not placards: each is the overlay itself, the same
 * components the overlays section demos, so what a visitor sees in the OBS
 * preview is what the browser source actually renders. Their clips rotators are
 * the only place on the page that plays the real montage.
 */
function AwayPreview({
  kind,
  scene,
  active,
}: {
  kind: "starting" | "brb" | "ending" | "lost";
  scene: string;
  active: boolean;
}) {
  const tick = useOverlayTick(active);
  const Overlay = AWAY_OVERLAYS[kind];
  return (
    <div className="@container relative h-full w-full overflow-hidden bg-black">
      <Overlay tick={tick} clipsVideo chat={<OverlayLiveChat />} />
      <ClockWidget sec={CLOCK_START + tick} />
      <span className="sr-only">{scene}</span>
    </div>
  );
}

function ScenePreview({ kind, scene, active }: { kind: DemoScene["preview"]; scene: string; active: boolean }) {
  if (kind === "irl") {
    return <IrlPreview active={active} />;
  }

  if (kind === "empty" || !kind) {
    // Exactly what the screenshot shows: a scene with nothing in it.
    return <div className="h-full w-full bg-black" />;
  }

  return <AwayPreview kind={kind} scene={scene} active={active} />;
}

export function ObsWindowMock() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });

  const { currentScene, switchingTo, streaming, togglingStream, streamSeconds, handoff, toggleStream, switchScene } =
    useObsDemo();
  const scene = useCurrentScene();
  // The deck just changed something: ring the control here that followed.
  const fromDeck = handoff?.from === "deck" ? handoff : null;
  const ring = "ring-2 ring-purple-400/80 ring-offset-1 ring-offset-[#272a33]";

  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [studioMode, setStudioMode] = useState(false);
  const track = useDemoTracking("cloud_obs");
  const [cpu, setCpu] = useState(0.3);

  const sources = scene.sources ?? [];

  // The stream clock belongs to the shared store (the deck can start it too);
  // the CPU readout is this window's own.
  useEffect(() => {
    if (!inView || !streaming) return;
    const id = setInterval(() => setCpu(Number((2.4 + Math.random() * 1.6).toFixed(1))), 1000);
    return () => clearInterval(id);
  }, [inView, streaming]);

  useEffect(() => {
    if (!streaming) setCpu(0.3);
  }, [streaming]);

  const pickScene = (next: DemoScene) => {
    if (next.divider) return;
    // Switching inside OBS is just a switch: no hold, the auto switcher stays
    // free to take the scene back.
    switchScene(next.name, { from: "obs" });
    setSelectedSource(null);
  };

  const controlButton =
    "w-full rounded-[2px] px-2 py-2 text-[10px] text-[#d3d8e2] transition-colors hover:brightness-125 sm:py-[5px]";

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Interactive demo of the cloud OBS window, open in a browser"
      data-handoff={handoffKey("obs", "frame")}
      className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#16171b] text-[10px] shadow-[0_16px_48px_-16px_rgba(158,122,255,0.25)] select-none"
    >
      {/* Browser chrome: the OBS window runs in a tab, nothing is installed. */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#1f2126] px-3 py-2">
        <span className="flex shrink-0 gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="ml-1 hidden shrink-0 items-center gap-1 text-[#6f7583] sm:flex">
          <ChevronLeft className="h-3 w-3" />
          <ChevronRight className="h-3 w-3" />
          <RotateCw className="h-2.5 w-2.5" />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-[#16171b] px-2 py-1 text-[10px] text-[#9aa1b2]">
          <Lock className="h-2.5 w-2.5 shrink-0 text-[#5f8a6a]" />
          <span className="truncate">
            streamwizard.org/obs-viewer?instanceId=
            <span className="text-[#c7ccd8]">facade1d-7e57-c0de-face-c0ffeedecade</span>
          </span>
        </span>
      </div>

      {/* noVNC window title bar */}
      <div style={{ background: SURFACE }}>
        <div className="flex h-6 items-center bg-black px-2 font-mono text-[10px] text-white/90">Cloud OBS</div>
        <div className="h-5" style={{ background: CHROME }} />
      </div>

      {/* Menu bar */}
      <div className="flex items-center gap-3 px-2 py-1 text-[10px] text-[#aeb5c4]" style={{ background: SURFACE }}>
        {MENUS.map((item, index) => (
          <span key={item} className={cn("whitespace-nowrap", index >= 4 && "hidden sm:inline")}>
            {item}
          </span>
        ))}
      </div>

      <div
        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_104px] gap-px sm:flex sm:gap-0"
        style={{ background: SURFACE }}
      >
        {/* Left column: scenes over sources */}
        <div className="contents sm:flex sm:w-[26%] sm:min-w-[112px] sm:shrink-0 sm:flex-col sm:gap-px">
          <div className="order-2 flex h-[184px] flex-col sm:order-none sm:h-[168px]" style={{ background: PANEL }}>
            <DockHeader title="Scenes" />
            <div className="min-h-0 flex-1 overflow-y-auto py-0.5">
              {DEMO_SCENES.map((item) =>
                item.divider ? (
                  <p key={item.name} className="truncate px-2 py-[3px] text-[#6d7386]">
                    {item.name}
                  </p>
                ) : (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => pickScene(item)}
                    data-handoff={handoffKey("obs", { scene: item.name })}
                    className={cn(
                      "block w-full truncate px-2 py-1 text-left text-[#d3d8e2] transition-[color,background-color,box-shadow] sm:py-[3px]",
                      item.name === currentScene ? "text-white" : "hover:bg-white/[0.06]",
                      fromDeck?.kind === "scene" && fromDeck.scene === item.name && cn(ring, "ring-inset"),
                    )}
                    style={item.name === currentScene ? { background: SELECTED } : undefined}
                  >
                    {item.name}
                    {item.name === switchingTo ? <span className="ml-1 text-[#9aa1b2]">…</span> : null}
                  </button>
                ),
              )}
            </div>
            <DockToolbar />
          </div>

          <div className="order-2 flex h-[184px] flex-col sm:order-none sm:h-[152px]" style={{ background: PANEL }}>
            <DockHeader title="Sources" />
            <div className="min-h-0 flex-1 overflow-y-auto py-0.5">
              {sources.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center text-[9px] leading-relaxed text-[#8f96a8]">
                  <span className="flex h-6 w-6 items-center justify-center rounded border border-[#4a5062] text-[#6d7386]">
                    ?
                  </span>
                  <p>
                    You don&apos;t have any sources.
                    <br />
                    Click the + button below,
                    <br />
                    or right click here to add one.
                  </p>
                </div>
              ) : (
                sources.map((source) => (
                  <button
                    key={source.name}
                    type="button"
                    onClick={() => {
                      track("obs_source_selected");
                      setSelectedSource(source.name);
                    }}
                    className={cn(
                      "block w-full truncate px-2 py-1 text-left text-[#d3d8e2] transition-colors sm:py-[3px]",
                      source.name === selectedSource ? "text-white" : "hover:bg-white/[0.06]",
                    )}
                    style={source.name === selectedSource ? { background: SELECTED } : undefined}
                  >
                    {source.name}
                  </button>
                ))
              )}
            </div>
            <DockToolbar extra />
          </div>
        </div>

        {/* Centre: preview, then the mixer and transitions docks */}
        <div className="contents sm:flex sm:min-w-0 sm:flex-1 sm:flex-col sm:gap-px sm:px-px">
          <div className="order-1 col-span-3 flex items-center justify-center bg-black sm:order-none sm:col-auto">
            {studioMode ? (
              <div className="grid w-full grid-cols-2 gap-2 p-2">
                {(["Preview", "Program"] as const).map((pane) => (
                  <div key={pane}>
                    <p className="mb-1 text-center text-[9px] text-[#9aa1b2]">{pane}</p>
                    <div className="aspect-video w-full overflow-hidden">
                      <ScenePreview kind={scene.preview} scene={scene.name} active={inView} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="aspect-video w-full overflow-hidden">
                <ScenePreview kind={scene.preview} scene={scene.name} active={inView} />
              </div>
            )}
          </div>

          <div
            className="order-1 col-span-3 flex items-center gap-2 px-2 py-1 text-[9px] text-[#9aa1b2] sm:order-none sm:col-auto"
            style={{ background: PANEL }}
          >
            <span className="rounded-[2px] px-1" style={{ background: RAISED }}>
              −
            </span>
            <span className="tabular-nums">62%</span>
            <span className="rounded-[2px] px-1" style={{ background: RAISED }}>
              +
            </span>
            <span className="ml-1 flex items-center gap-1 rounded-[2px] px-1.5 py-0.5" style={{ background: RAISED }}>
              Scale to Window
              <ChevronDown className="h-2.5 w-2.5" />
            </span>
          </div>

          <div
            className="order-1 col-span-3 flex items-center gap-2 px-2 py-1 text-[9px] text-[#c7ccd8] sm:order-none sm:col-auto"
            style={{ background: PANEL }}
          >
            <span className="min-w-0 flex-1 truncate">{selectedSource ?? "No source selected"}</span>
            <span
              className={cn("flex items-center gap-1 rounded-[2px] px-1.5 py-0.5", !selectedSource && "opacity-50")}
              style={{ background: RAISED }}
            >
              <Settings2 className="h-2.5 w-2.5" />
              Properties
            </span>
            <span
              className={cn("flex items-center gap-1 rounded-[2px] px-1.5 py-0.5", !selectedSource && "opacity-50")}
              style={{ background: RAISED }}
            >
              <SlidersHorizontal className="h-2.5 w-2.5" />
              Filters
            </span>
          </div>

          <div className="order-3 col-span-3 flex gap-px sm:order-none sm:col-auto">
            <div className="flex h-[104px] min-w-0 flex-1 flex-col" style={{ background: SURFACE }}>
              <DockHeader title="Audio Mixer" />
              <div className="min-h-0 flex-1" />
              <div
                className="flex items-center gap-2 px-2 py-1 text-[9px] text-[#9aa1b2]"
                style={{ background: PANEL }}
              >
                <span className="rounded-[2px] px-1" style={{ background: RAISED }}>
                  0 hidden
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <SlidersHorizontal className="h-2.5 w-2.5" />
                  <Settings2 className="h-2.5 w-2.5" />
                  <span className="flex items-center gap-1 rounded-[2px] px-1" style={{ background: RAISED }}>
                    Options
                    <ChevronDown className="h-2.5 w-2.5" />
                  </span>
                </span>
              </div>
            </div>

            <div className="flex h-[104px] w-[38%] min-w-0 flex-col" style={{ background: SURFACE }}>
              <DockHeader title="Scene Transitions" />
              <div className="space-y-1 p-1.5">
                <div
                  className="flex items-center justify-between rounded-[2px] px-1.5 py-0.5 text-[9px] text-[#d3d8e2]"
                  style={{ background: RAISED }}
                >
                  Stinger
                  <ChevronDown className="h-2.5 w-2.5" />
                </div>
                <div className="flex items-center justify-end gap-2 text-[#9aa1b2]">
                  <Plus className="h-3 w-3" />
                  <Trash2 className="h-3 w-3" />
                  <MoreVertical className="h-3 w-3" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: the controls dock */}
        <div
          className="order-2 flex flex-col sm:order-none sm:w-[20%] sm:min-w-[92px] sm:shrink-0"
          style={{ background: PANEL }}
        >
          <DockHeader title="Controls" />
          <div className="space-y-1 p-1.5">
            <button
              type="button"
              onClick={() => toggleStream("obs")}
              disabled={togglingStream}
              data-handoff={handoffKey("obs", "stream")}
              className={cn(
                controlButton,
                "transition-[color,background-color,box-shadow]",
                fromDeck?.kind === "stream" && ring,
              )}
              style={{ background: streaming ? "#7a2230" : RAISED }}
            >
              {togglingStream ? "Working…" : streaming ? "Stop Streaming" : "Start Streaming"}
            </button>
            <button
              type="button"
              onClick={() => {
                track("obs_studio_mode_toggled");
                setStudioMode((on) => !on);
              }}
              className={controlButton}
              style={{ background: studioMode ? SELECTED : RAISED }}
            >
              Studio Mode
            </button>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-end gap-3 px-2 py-1 text-[9px] tabular-nums text-[#9aa1b2]"
        style={{ background: PANEL }}
      >
        <span className="flex items-center gap-1">
          <span className={cn("h-1.5 w-1.5 rounded-full", streaming ? "bg-green-500" : "bg-[#5a6072]")} />
          {clock(streamSeconds)}
        </span>
        <span>CPU: {cpu}%</span>
        <span>30.00 / 30.00 FPS</span>
      </div>
    </div>
  );
}
