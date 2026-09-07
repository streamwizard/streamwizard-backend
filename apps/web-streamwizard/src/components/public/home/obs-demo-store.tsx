"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEMO_SCENES, SCENE_REACTIONS, SEED_CHAT, WENT_LIVE, WENT_OFFLINE, type MockMessage } from "./obs-demo-data";
import { useDemoTracking } from "../analytics/use-demo-tracking";

/*
 * One demo, two windows. The OBS window and the mobile deck on the cloud OBS
 * section are the same fake stream: switching a scene in either moves the
 * other, and going live from the deck flips the OBS controls and starts its
 * timer, the way the real websocket would.
 *
 * State lives here rather than in either component so neither owns the other,
 * and so a third surface could join later without rewiring anything. The
 * handoff arrow (`handoff-arrow`) is that third surface: it reads which window
 * made the last change and draws the hop to the control that reacted.
 */

export interface ChatEntry extends MockMessage {
  id: number;
}

export type DemoSide = "obs" | "deck";

/** How long the fake OBS takes to act on a control, so the arrow can land on the flip. */
export const STREAM_TOGGLE_MS = 700;
export const SCENE_SWITCH_MS = 550;

/** How long the handoff arrow and the target's ring stay up. */
const HANDOFF_MS = 2400;

/**
 * Each cue shows once per page load: the arrow explains that the two windows
 * are linked, and once a visitor has seen it for a scene switch, for going
 * live and for ending the stream, repeating it is noise. A refresh starts
 * over.
 */
type HandoffCue = "scene" | "stream:start" | "stream:stop";

/**
 * One change made in one window, for the arrow to draw to the other. Elements
 * the arrow can land on carry a `data-handoff` key built by `handoffKey`; the
 * `${side}-frame` keys are the whole window, the fallback when the precise
 * control is not on screen (the deck's tabs, scenes the deck hides).
 */
export type Handoff =
  | { id: number; from: DemoSide; kind: "stream"; settleMs: number }
  | { id: number; from: DemoSide; kind: "scene"; scene: string; settleMs: number };

/** `Omit` would collapse the union; this keeps each variant. */
type PendingHandoff = Handoff extends infer H ? (H extends Handoff ? Omit<H, "id"> : never) : never;

export type HandoffTarget = "stream" | "frame" | { scene: string };

export function handoffKey(side: DemoSide, target: HandoffTarget): string {
  if (target === "stream" || target === "frame") return `${side}-${target}`;
  return `${side}-scene:${target.scene}`;
}

interface ObsDemo {
  currentScene: string;
  switchingTo: string | null;
  sceneChangedAt: Date | null;
  /** Set when the switch came from the deck: a deck tap holds the scene. */
  heldScene: string | null;
  releasing: boolean;
  streaming: boolean;
  togglingStream: boolean;
  streamSeconds: number;
  lastSwitch: { at: number; to: string } | null;
  /** Set for a moment after a change: which window made it, and what it was. */
  handoff: Handoff | null;
  chat: ChatEntry[];
  unread: number;
  switchScene: (name: string, options: { from: DemoSide; hold?: boolean }) => void;
  releaseHold: () => void;
  toggleStream: (from: DemoSide) => void;
  appendChat: (message: MockMessage) => void;
  /** The deck tells the store whether its chat tab is on screen. */
  setChatOpen: (open: boolean) => void;
}

const ObsDemoContext = createContext<ObsDemo | null>(null);

export function useObsDemo(): ObsDemo {
  const value = useContext(ObsDemoContext);
  if (!value) throw new Error("useObsDemo must be used inside <ObsDemoProvider>");
  return value;
}

export function ObsDemoProvider({ children }: { children: ReactNode }) {
  // The demo opens on the IRL scene with the stream off, so going live is the
  // first thing a visitor can do from either window.
  const [currentScene, setCurrentScene] = useState("IRL");
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [sceneChangedAt, setSceneChangedAt] = useState<Date | null>(null);
  const [heldScene, setHeldScene] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [togglingStream, setTogglingStream] = useState(false);
  const [streamSeconds, setStreamSeconds] = useState(0);
  const [lastSwitch, setLastSwitch] = useState<{ at: number; to: string } | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>(() => SEED_CHAT.map((message, i) => ({ id: i, ...message })));
  const [unread, setUnread] = useState(0);

  // Shared actions report here so a scene switch counts the same whichever
  // window it came from; the side is in the action name.
  const track = useDemoTracking("cloud_obs");

  const nextIdRef = useRef(SEED_CHAT.length);
  const handoffIdRef = useRef(0);
  const handoffActiveRef = useRef(false);
  const seenRef = useRef(new Set<HandoffCue>());
  const chatOpenRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Busy guards are refs, not the state above: an updater that also schedules a
  // timer would schedule it twice under StrictMode's double invoke.
  const switchingRef = useRef<string | null>(null);
  const releasingRef = useRef(false);
  const togglingRef = useRef(false);
  const streamingRef = useRef(false);
  const sceneRef = useRef("IRL");

  // Every fake delay goes through here, so nothing fires after unmount.
  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!streaming) return;
    const id = setInterval(() => setStreamSeconds((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [streaming]);

  const appendChat = useCallback((message: MockMessage) => {
    // Capped: this can idle in a background browser tab for a long time.
    setChat((prev) => [...prev, { id: nextIdRef.current++, ...message }].slice(-40));
    if (!chatOpenRef.current) setUnread((count) => count + 1);
  }, []);

  const setChatOpen = useCallback((open: boolean) => {
    chatOpenRef.current = open;
    if (open) setUnread(0);
  }, []);

  // One arrow at a time, and each cue once per page load. A visitor hammering
  // the scene grid gets the scenes (those have their own busy guard) but not
  // an arrow per tap: the first one runs its course and later changes inside
  // its window draw nothing.
  const startHandoff = useCallback(
    (cue: HandoffCue, handoff: PendingHandoff) => {
      if (handoffActiveRef.current) return;
      if (seenRef.current.has(cue)) return;
      seenRef.current.add(cue);
      handoffActiveRef.current = true;
      setHandoff({ ...handoff, id: ++handoffIdRef.current });
      later(() => {
        handoffActiveRef.current = false;
        setHandoff(null);
      }, HANDOFF_MS);
    },
    [later],
  );

  const switchScene = useCallback(
    (name: string, options: { from: DemoSide; hold?: boolean }) => {
      if (switchingRef.current || name === sceneRef.current) return;
      track(`${options.from}_scene_switched`, { scene: name });
      switchingRef.current = name;
      setSwitchingTo(name);
      startHandoff("scene", { from: options.from, kind: "scene", scene: name, settleMs: SCENE_SWITCH_MS });
      later(() => {
        switchingRef.current = null;
        sceneRef.current = name;
        setSwitchingTo(null);
        setCurrentScene(name);
        setSceneChangedAt(new Date());
        setLastSwitch({ at: Date.now(), to: name });
        // A deck tap IS the hold; switching inside OBS is just a switch, and
        // the auto switcher stays free to take it back.
        if (options.hold) setHeldScene(name);
        const reaction = SCENE_REACTIONS[name];
        if (reaction) appendChat(reaction);
      }, SCENE_SWITCH_MS);
    },
    [later, appendChat, startHandoff, track],
  );

  const releaseHold = useCallback(() => {
    if (releasingRef.current) return;
    track("deck_hold_released");
    releasingRef.current = true;
    setReleasing(true);
    later(() => {
      releasingRef.current = false;
      setReleasing(false);
      setHeldScene(null);
    }, 500);
  }, [later, track]);

  const toggleStream = useCallback(
    (from: DemoSide) => {
      if (togglingRef.current) return;
      togglingRef.current = true;
      setTogglingStream(true);
      const next = !streamingRef.current;
      track(`${from}_stream_${next ? "started" : "stopped"}`);
      startHandoff(next ? "stream:start" : "stream:stop", { from, kind: "stream", settleMs: STREAM_TOGGLE_MS });
      later(() => {
        togglingRef.current = false;
        streamingRef.current = next;
        setTogglingStream(false);
        setStreaming(next);
        if (!next) setStreamSeconds(0);
        appendChat(next ? WENT_LIVE : WENT_OFFLINE);
      }, STREAM_TOGGLE_MS);
    },
    [later, appendChat, startHandoff, track],
  );

  const value = useMemo<ObsDemo>(
    () => ({
      currentScene,
      switchingTo,
      sceneChangedAt,
      heldScene,
      releasing,
      streaming,
      togglingStream,
      streamSeconds,
      lastSwitch,
      handoff,
      chat,
      unread,
      switchScene,
      releaseHold,
      toggleStream,
      appendChat,
      setChatOpen,
    }),
    [
      currentScene,
      switchingTo,
      sceneChangedAt,
      heldScene,
      releasing,
      streaming,
      togglingStream,
      streamSeconds,
      lastSwitch,
      handoff,
      chat,
      unread,
      switchScene,
      releaseHold,
      toggleStream,
      appendChat,
      setChatOpen,
    ],
  );

  return <ObsDemoContext.Provider value={value}>{children}</ObsDemoContext.Provider>;
}

/** The scene the OBS window is showing, with its preview and source list. */
export function useCurrentScene() {
  const { currentScene } = useObsDemo();
  return DEMO_SCENES.find((scene) => scene.name === currentScene) ?? DEMO_SCENES[1]!;
}
