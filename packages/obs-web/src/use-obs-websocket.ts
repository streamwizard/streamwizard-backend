"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// obs-websocket v5 op codes
const OP_HELLO = 0;
const OP_IDENTIFY = 1;
const OP_IDENTIFIED = 2;
const OP_REQUEST = 6;
const OP_REQUEST_RESPONSE = 7;
const OP_EVENT = 5;

// General | Scenes | Outputs | Vendors
const EVENT_SUBSCRIPTIONS = (1 << 0) | (1 << 2) | (1 << 6) | (1 << 9);

export type ObsConnectionStatus = "closed" | "connecting" | "open";

export interface Scene {
  sceneName: string;
  sceneIndex: number;
  // Stable across renames — the auto switcher stores scenes by uuid so a
  // renamed scene doesn't break switching.
  sceneUuid: string;
}

export interface SceneItem {
  sceneItemId: number;
  sourceUuid: string;
  sourceName: string;
}

export interface SourceStatNode {
  name: string;
  category: string;
  sourceType?: string;
  displayName?: string;
  kindId?: string;
  uuid?: string;
  width?: number;
  height?: number;
  active: boolean;
  rendered?: boolean;
  enabled: boolean;
  async: boolean;
  filter: boolean;
  private?: boolean;
  childCount?: number;
  cpuPercentage?: number;
  gpuPercentage?: number;
  totalPercentage?: number;
  tickAvg?: number;
  renderAvg?: number;
  renderTotal?: number;
  renderGpuTotal?: number;
  total?: number;
  asyncInputFps?: number;
  asyncRenderedFps?: number;
  children: SourceStatNode[];
}

export interface ObsStats {
  cpuUsage: number;
  memoryUsage: number;
  activeFps: number;
  averageFrameRenderTime: number;
  renderSkippedFrames: number;
  outputSkippedFrames: number;
}

export interface SourceStatsPayload {
  frameTime: number;
  sources: SourceStatNode[];
}

// obs-websocket v5 auth: base64(sha256(base64(sha256(password + salt)) + challenge))
async function computeAuth(password: string, salt: string, challenge: string): Promise<string> {
  const enc = new TextEncoder();
  const secretHash = await crypto.subtle.digest("SHA-256", enc.encode(password + salt));
  const secret = btoa(String.fromCharCode(...new Uint8Array(secretHash)));
  const authHash = await crypto.subtle.digest("SHA-256", enc.encode(secret + challenge));
  return btoa(String.fromCharCode(...new Uint8Array(authHash)));
}

interface UseObsWebSocketOptions {
  getWsUrl: (() => Promise<string>) | null;
  password: string | null;
}

const RETRY_DELAY_MS = 3_000;
const MAX_AUTO_RETRIES = 30; // ~90 seconds of waiting

export function useObsWebSocket({ getWsUrl, password }: UseObsWebSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const connectingRef = useRef(false);
  const pendingRef = useRef<Map<string, { resolve: (data: unknown) => void; reject: (err: Error) => void }>>(new Map());
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  // Map of `${sceneName}:${uuid}` → sceneItemId (integer) for SetSceneItemEnabled
  const sceneItemMapRef = useRef<Map<string, number>>(new Map());

  const [status, setStatus] = useState<ObsConnectionStatus>("closed");
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneItems, setSceneItems] = useState<Record<string, SceneItem[]>>({});
  const [currentScene, setCurrentScene] = useState<string | null>(null);
  // When the current scene last changed, captured at the moment the change is
  // observed (event, switch, or initial fetch) so consumers don't need their
  // own change-detection effects to show an "updated at" time.
  const [sceneChangedAt, setSceneChangedAt] = useState<Date | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [togglingStream, setTogglingStream] = useState(false);
  const [sourceStats, setSourceStats] = useState<SourceStatsPayload | null>(null);
  const [obsStats, setObsStats] = useState<ObsStats | null>(null);

  // Scenes filtered to exclude names starting with - or _
  const filteredScenes = scenes.filter((s) => !/^[-_]/.test(s.sceneName));

  const send = useCallback((op: number, d: unknown) => {
    socketRef.current?.send(JSON.stringify({ op, d }));
  }, []);

  const request = useCallback(<T = unknown>(requestType: string, requestData?: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      pendingRef.current.set(requestId, {
        resolve: (data) => resolve(data as T),
        reject,
      });
      send(OP_REQUEST, { requestType, requestId, requestData });
      setTimeout(() => {
        if (pendingRef.current.has(requestId)) {
          pendingRef.current.delete(requestId);
          reject(new Error(`Request "${requestType}" timed out`));
        }
      }, 10_000);
    });
  }, [send]);

  const fetchScenes = useCallback(async () => {
    const data = await request<{ scenes: Scene[]; currentProgramSceneName: string }>("GetSceneList");
    const sorted = data.scenes.slice().sort((a, b) => b.sceneIndex - a.sceneIndex);
    setScenes(sorted);
    setCurrentScene(data.currentProgramSceneName);
    setSceneChangedAt(new Date());

    // Build sceneItemId lookup for each scene so we can call SetSceneItemEnabled
    const map = new Map<string, number>();
    const itemsByScene: Record<string, SceneItem[]> = {};
    await Promise.all(
      sorted.map(async (scene) => {
        try {
          const items = await request<{ sceneItems: SceneItem[] }>(
            "GetSceneItemList",
            { sceneName: scene.sceneName }
          );
          itemsByScene[scene.sceneName] = items.sceneItems;
          for (const item of items.sceneItems) {
            map.set(`${scene.sceneName}:${item.sourceUuid}`, item.sceneItemId);
          }
        } catch {
          // non-fatal; toggle will be a no-op for items missing from the map
        }
      })
    );
    sceneItemMapRef.current = map;
    setSceneItems(itemsByScene);
  }, [request]);

  // Creates a scene if it doesn't already exist. Safe to call unconditionally —
  // a duplicate-name create is treated as a no-op rather than an error.
  const createScene = useCallback(async (sceneName: string) => {
    try {
      await request("CreateScene", { sceneName });
    } catch {
      // Most likely "already exists" — refetch below will confirm either way.
    }
    await fetchScenes();
  }, [request, fetchScenes]);

  const ensureSceneExists = useCallback(async (sceneName: string) => {
    const data = await request<{ scenes: Scene[] }>("GetSceneList");
    if (data.scenes.some((s) => s.sceneName === sceneName)) return;
    await createScene(sceneName);
  }, [request, createScene]);

  const sceneHasSource = useCallback((sceneName: string, sourceName: string) => {
    return (sceneItems[sceneName] ?? []).some((item) => item.sourceName === sourceName);
  }, [sceneItems]);

  const fetchStreamStatus = useCallback(async () => {
    const data = await request<{ outputActive: boolean }>("GetStreamStatus");
    setIsStreaming(data.outputActive);
  }, [request]);

  const switchScene = useCallback(async (sceneName: string) => {
    setSwitchingTo(sceneName);
    try {
      await request("SetCurrentProgramScene", { sceneName });
      setCurrentScene(sceneName);
      setSceneChangedAt(new Date());
    } finally {
      setSwitchingTo(null);
    }
  }, [request]);

  const toggleStream = useCallback(async () => {
    setTogglingStream(true);
    try {
      await request("ToggleStream");
      setIsStreaming((prev) => !prev);
    } finally {
      setTogglingStream(false);
    }
  }, [request]);

  const setSceneItemEnabled = useCallback(async (sceneName: string, sourceUuid: string, enabled: boolean) => {
    const sceneItemId = sceneItemMapRef.current.get(`${sceneName}:${sourceUuid}`);
    if (sceneItemId === undefined) return;
    await request("SetSceneItemEnabled", { sceneName, sceneItemId, sceneItemEnabled: enabled });
  }, [request]);

  const setSourceFilterEnabled = useCallback(async (sourceName: string, filterName: string, enabled: boolean) => {
    await request("SetSourceFilterEnabled", { sourceName, filterName, filterEnabled: enabled });
  }, [request]);

  // Creates a Media Source pulling `url` (an ingest output's SRT URL) and
  // drops it straight into `sceneName`, enabled. Refreshes the scene item map
  // afterward so the new item's toggle works in the Sources tree right away.
  //
  // - restart_on_activate: false — the IRL feed is a live pull, not a clip;
  //   restarting playback each time the source activates just adds a stall.
  // - reconnect_delay_sec: 2 — faster recovery when the ingest link drops.
  // After creation the source is stretched to fill the whole canvas so the
  // feed is fullscreen from the start (OBS drops a new media source at its
  // native pixel size otherwise, which can leave it invisible/off-frame).
  const addMediaSourceToScene = useCallback(async (sceneName: string, inputName: string, url: string) => {
    const created = await request<{ sceneItemId: number }>("CreateInput", {
      sceneName,
      inputName,
      inputKind: "ffmpeg_source",
      inputSettings: {
        is_local_file: false,
        input: url,
        restart_on_activate: false,
        reconnect_delay_sec: 2,
      },
      sceneItemEnabled: true,
    });

    // Fill the canvas: bound the item to the base (canvas) resolution and let
    // OBS scale the feed to fit inside those bounds.
    try {
      const video = await request<{ baseWidth: number; baseHeight: number }>("GetVideoSettings");
      await request("SetSceneItemTransform", {
        sceneName,
        sceneItemId: created.sceneItemId,
        sceneItemTransform: {
          positionX: 0,
          positionY: 0,
          boundsType: "OBS_BOUNDS_SCALE_INNER",
          boundsWidth: video.baseWidth,
          boundsHeight: video.baseHeight,
        },
      });
    } catch {
      // Non-fatal: source is still added, just not auto-sized.
    }

    await fetchScenes();
  }, [request, fetchScenes]);

  // Creates a Browser Source pointed at `url` (an alert widget link, e.g.
  // StreamElements) and drops it into `sceneName`, enabled. Sized to a
  // standard 1080p canvas — alert widgets are transparent overlays, so this
  // covers the frame without needing per-widget dimensions. `reroute_audio`
  // ("Control audio via OBS" in the UI) is on so alert sound routes through
  // OBS's mixer — required for the Source Clone in addSourceCloneToScene to
  // carry audio into other scenes at all.
  const addBrowserSourceToScene = useCallback(async (sceneName: string, inputName: string, url: string) => {
    await request("CreateInput", {
      sceneName,
      inputName,
      inputKind: "browser_source",
      inputSettings: { url, width: 1920, height: 1080, reroute_audio: true },
      sceneItemEnabled: true,
    });
    await fetchScenes();
  }, [request, fetchScenes]);

  // Creates a Source Clone (the exeldro obs-source-clone plugin, bundled with
  // every StreamWizard instance) in `sceneName` that mirrors `sourceName`'s
  // render output. Used to repeat an alert widget across scenes without
  // running a second browser process per scene — a real duplicate browser
  // source per scene would multiply CPU cost with every scene it's added to.
  const addSourceCloneToScene = useCallback(async (sceneName: string, inputName: string, sourceName: string) => {
    await request("CreateInput", {
      sceneName,
      inputName,
      inputKind: "source-clone",
      inputSettings: { clone: sourceName, clone_type: 0, audio: true },
      sceneItemEnabled: true,
    });
    await fetchScenes();
  }, [request, fetchScenes]);

  const connect = useCallback(() => {
    if (!getWsUrl || socketRef.current || connectingRef.current) return;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    connectingRef.current = true;
    setStatus("connecting");

    getWsUrl().then((wsUrl) => {
      connectingRef.current = false;
      if (socketRef.current) return;

      let everConnected = false;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data as string);

        if (message.op === OP_HELLO) {
          const { rpcVersion, authentication } = message.d as {
            rpcVersion: number;
            authentication?: { challenge: string; salt: string };
          };
          if (authentication && password) {
            computeAuth(password, authentication.salt, authentication.challenge).then((authString) => {
              send(OP_IDENTIFY, { rpcVersion, authentication: authString, eventSubscriptions: EVENT_SUBSCRIPTIONS });
            });
          } else {
            send(OP_IDENTIFY, { rpcVersion, eventSubscriptions: EVENT_SUBSCRIPTIONS });
          }
        } else if (message.op === OP_IDENTIFIED) {
          everConnected = true;
          retryCountRef.current = 0;
          setIsAutoRetrying(false);
          setHasTimedOut(false);
          setStatus("open");
          fetchScenes().catch(() => {});
          fetchStreamStatus().catch(() => {});
          const pollStats = () => {
            request<ObsStats>("GetStats").then(setObsStats).catch(() => {});
          };
          pollStats();
          statsIntervalRef.current = setInterval(pollStats, 2000);
        } else if (message.op === OP_REQUEST_RESPONSE) {
          const { requestId, requestStatus, responseData } = message.d as {
            requestId: string;
            requestStatus?: { result: boolean; code: number; comment?: string };
            responseData: unknown;
          };
          const pending = pendingRef.current.get(requestId);
          if (pending) {
            pendingRef.current.delete(requestId);
            if (requestStatus && !requestStatus.result) {
              pending.reject(new Error(requestStatus.comment || `Request failed (code ${requestStatus.code})`));
            } else {
              pending.resolve(responseData);
            }
          }
        } else if (message.op === OP_EVENT) {
          const { eventType, eventData } = message.d as {
            eventType: string;
            eventData: Record<string, unknown>;
          };
          if (eventType === "CurrentProgramSceneChanged") {
            setCurrentScene(eventData.sceneName as string);
            setSceneChangedAt(new Date());
          } else if (eventType === "StreamStateChanged") {
            setIsStreaming(eventData.outputActive as boolean);
          } else if (eventType === "SceneListChanged") {
            fetchScenes().catch(() => {});
          } else if (eventType === "VendorEvent") {
            // vendorName lives inside eventData for VendorEvent, not at the top level
            const { vendorName, eventType: innerType, eventData: innerData } = eventData as {
              vendorName: string;
              eventType: string;
              eventData: SourceStatsPayload;
            };
            if (vendorName === "streamwizard-stats" && innerType === "SourceStats") {
              setSourceStats(innerData);
            }
          }
        }
      });

      socket.addEventListener("close", () => {
        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current);
          statsIntervalRef.current = null;
        }
        socketRef.current = null;
        pendingRef.current.forEach((p) => p.reject(new Error("Connection closed")));
        pendingRef.current.clear();
        sceneItemMapRef.current.clear();
        setStatus("closed");
        setScenes([]);
        setSceneItems({});
        setCurrentScene(null);
        setSceneChangedAt(null);
        setIsStreaming(false);
        setSourceStats(null);
        setObsStats(null);

        // OBS wasn't ready yet — schedule a retry while we still have a URL.
        // Once OBS has connected at least once, close means the user stopped
        // the container intentionally, so we don't auto-retry.
        if (!everConnected) {
          retryCountRef.current += 1;
          if (retryCountRef.current < MAX_AUTO_RETRIES) {
            setIsAutoRetrying(true);
            retryTimerRef.current = setTimeout(() => {
              retryTimerRef.current = null;
              connect();
            }, RETRY_DELAY_MS);
          } else {
            // Exhausted the retry budget without OBS ever coming up. Surface a
            // distinct "timed out" state so the UI can offer a clear recovery
            // path instead of an indistinguishable "Disconnected".
            setIsAutoRetrying(false);
            setHasTimedOut(true);
          }
        }
      });

      socket.addEventListener("error", () => {
        socketRef.current?.close();
      });
    }).catch(() => {
      connectingRef.current = false;
      setStatus("closed");
    });
  }, [getWsUrl, password, send, fetchScenes, fetchStreamStatus]);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
  }, []);

  // Manual reconnect after a timeout: the auto-retry loop reuses `connect`, so
  // we must reset the retry budget here or a timed-out socket would refuse to
  // try again (retryCount is already at MAX).
  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    setHasTimedOut(false);
    setIsAutoRetrying(false);
    connect();
  }, [connect]);

  useEffect(() => {
    retryCountRef.current = 0;
    setIsAutoRetrying(false);
    setHasTimedOut(false);
    if (getWsUrl) connect();
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      socketRef.current?.close();
    };
  }, [getWsUrl, connect]);

  return {
    status,
    isAutoRetrying,
    hasTimedOut,
    scenes,
    sceneItems,
    filteredScenes,
    currentScene,
    sceneChangedAt,
    isStreaming,
    switchingTo,
    togglingStream,
    sourceStats,
    obsStats,
    connect,
    reconnect,
    disconnect,
    switchScene,
    toggleStream,
    setSceneItemEnabled,
    setSourceFilterEnabled,
    addMediaSourceToScene,
    addBrowserSourceToScene,
    addSourceCloneToScene,
    createScene,
    ensureSceneExists,
    sceneHasSource,
  };
}
