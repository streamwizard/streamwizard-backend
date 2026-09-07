"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Play, Square } from "lucide-react";
import {
  DEMO_EVENTS,
  DEMO_EVENT_DEFS,
  DEMO_EVENT_TYPES,
  isDemoEventType,
  type DemoEventType,
} from "@repo/schemas";
import type { DemoFireRequest, FireMode } from "./demo-fire";
import {
  ALERT_EVENT_CATEGORIES,
  ALERT_EVENT_LABELS,
  ALERT_EVENT_SUBSCRIPTION_TYPES,
  WIDGET_SIMULATORS,
  scanWidgetListeners,
  type AlertEventCategoryId,
} from "@repo/ui/overlay";
import { Button, Separator, Textarea, ToggleGroup, ToggleGroupItem } from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";

/**
 * The bar's quick buttons, derived from the alert box rather than hand-picked,
 * so the two panels can't drift. It matters which event each one fires: the
 * alert widget treats `channel.chat.notification` as the single source for the
 * dozen notices and ignores `channel.subscribe`/`channel.raid` outright, so a
 * hand-written "Sub" button pointed at `channel.subscribe` looks right and does
 * nothing. `ALERT_EVENT_SUBSCRIPTION_TYPES` already holds the correct
 * type+variant pair for all 23, and its `type` is a `WidgetTestEventType`,
 * a subset of `DemoEventType`.
 *
 * The picker below still lists the full catalogue -- custom widgets are written
 * against the dedicated subscription types and need them reachable.
 */
const ALERT_BUTTON_GROUPS = ALERT_EVENT_CATEGORIES.map((category) => ({
  id: category.id,
  label: category.label,
  events: category.events.map((event) => {
    const { type, variant } = ALERT_EVENT_SUBSCRIPTION_TYPES[event];
    return {
      type,
      variant,
      label: ALERT_EVENT_LABELS[event],
      // Which listener a custom widget would have to handle. Worth surfacing:
      // half of these are notice types on a shared subscription, which isn't
      // guessable from a button that just says "Gift sub".
      hint: `Fires ${type}${variant ? ` · ${variant}` : ""}`,
    };
  }),
}));

/**
 * Below this, a Live simulator is more round trips than the server action
 * should take. Local has no such cost, so the cap only applies to Live.
 */
const MIN_LIVE_INTERVAL_MS = 1000;

/** Picker group holding the events the widget's own source references. */
const USED_GROUP = "Used by this widget";

function storageKey(storageId: string) {
  return `sw:demo-panel:${storageId}`;
}

/** The widget editor's old key, read once so saved payloads survive the rename. */
function legacyStorageKey(storageId: string) {
  return `sw:widget-editor:test-event:${storageId}`;
}

function prettyPayload(type: DemoEventType) {
  return JSON.stringify(DEMO_EVENTS[type].build(), null, 2);
}

function readSaved(storageId: string): {
  type: DemoEventType;
  payload: string;
  edited: boolean;
} {
  const fallback = {
    type: "channel.follow" as DemoEventType,
    payload: prettyPayload("channel.follow"),
    edited: false,
  };
  try {
    const raw =
      localStorage.getItem(storageKey(storageId)) ??
      localStorage.getItem(legacyStorageKey(storageId));
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as { type?: string; payload?: string };
    if (!saved.type || !isDemoEventType(saved.type)) return fallback;
    return {
      type: saved.type,
      payload: saved.payload ?? prettyPayload(saved.type),
      edited: Boolean(saved.payload),
    };
  } catch {
    // corrupt or unavailable storage — start clean
    return fallback;
  }
}

export interface DemoEventPanelProps {
  /** Namespaces localStorage. Widget id in the widget editor, scene id in the overlay editor. */
  storageId: string;
  /**
   * Live-mode gate. A boolean means the caller owns a socket and Live should
   * follow it; `undefined` means Live is always offered, which is right for
   * hosts with no socket of their own -- delivery goes through the server
   * action, not the caller's connection.
   */
  wsConnected?: boolean;
  /**
   * Controlled fire mode. A host that owns one switch for the whole live story
   * (the widget editor) passes the mode alone and the panel's toggle
   * disappears. A host that shares the mode with other panels (the overlay
   * editor, whose alert inspector fires through it too) passes `onModeChange`
   * as well and keeps the toggle. Omitted, the panel owns the mode itself.
   */
  mode?: FireMode;
  /** Makes a controlled `mode` writable, so the panel keeps its toggle. */
  onModeChange?: (mode: FireMode) => void;
  /**
   * The widget's JS, used to lead the picker with the events it actually
   * handles. The overlay editor joins every custom widget on the canvas.
   * Omit it and the full catalogue shows flat.
   */
  sourceJs?: string;
  /**
   * Delivery. The panel picks the event; the host decides where it goes, since
   * only the host knows what it is previewing into. It is handed the request,
   * not a built payload, so a Live fire can let the server rebuild the fixture.
   */
  onFire: (request: DemoFireRequest) => Promise<boolean>;
  /** Reported so the host can badge its toolbar while simulators loop. */
  onRunningSimulatorsChange?: (ids: string[]) => void;
  className?: string;
}

export function DemoEventPanel({
  storageId,
  sourceJs,
  wsConnected,
  mode: controlledMode,
  onModeChange,
  onFire,
  onRunningSimulatorsChange,
  className,
}: DemoEventPanelProps) {
  const [saved] = useState(() => readSaved(storageId));
  const [mode, setMode] = useState<FireMode>("local");
  const [selected, setSelected] = useState<DemoEventType>(saved.type);
  /** Same default and same three groups as the alert inspector's tabs. */
  const [alertCategory, setAlertCategory] = useState<AlertEventCategoryId>("community");
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [payloadText, setPayloadText] = useState(saved.payload);
  /** Untouched payloads are rebuilt per fire so timestamps and ids stay fresh. */
  const [payloadEdited, setPayloadEdited] = useState(saved.edited);
  const [isSending, startSend] = useTransition();
  const [runningIds, setRunningIds] = useState<string[]>([]);

  // Stop functions for the simulators currently looping. In a ref because the
  // cleanup below must reach the live set, not the set captured at mount.
  const stopFnsRef = useRef(new Map<string, () => void>());

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey(storageId),
        JSON.stringify({ type: selected, payload: payloadEdited ? payloadText : undefined })
      );
    } catch {
      // storage full or blocked — persistence is a nicety, not a requirement
    }
  }, [storageId, selected, payloadEdited, payloadText]);

  // A simulator that outlives the editor keeps firing at nothing forever.
  useEffect(() => {
    const stopFns = stopFnsRef.current;
    return () => {
      for (const stop of stopFns.values()) stop();
      stopFns.clear();
    };
  }, []);

  useEffect(() => {
    onRunningSimulatorsChange?.(runningIds);
    // The callback is usually an inline arrow; depending on it would re-run
    // this on every render of the host.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningIds]);

  // Derived, not stored: losing the socket mid-session must fall back to Local
  // without clobbering the author's choice for when it reconnects.
  const liveAvailable = wsConnected === undefined || wsConnected;
  const effectiveMode: FireMode = liveAvailable ? (controlledMode ?? mode) : "local";
  // A controlled mode with no setter belongs to the host's own switch, so the
  // panel shows none. With a setter, the mode is shared and the panel drives it.
  const changeMode = onModeChange ?? (controlledMode === undefined ? setMode : null);

  /**
   * Reading the widget's own source is enough to tell which events it handles,
   * which beats making a streamer guess from a list of seventy. Cheap enough to
   * redo as an author types in the widget editor.
   */
  const scan = useMemo(
    () => (sourceJs ? scanWidgetListeners(sourceJs, DEMO_EVENT_TYPES) : null),
    [sourceJs]
  );

  const detected = useMemo(() => {
    if (!scan?.confident) return [];
    return scan.listeners.filter(isDemoEventType);
  }, [scan]);

  const grouped = useMemo(() => {
    const out = new Map<string, DemoEventType[]>();
    // Detected events lead in their own group and are listed once -- a value
    // repeated across two SelectGroups confuses Radix's selection. Nothing is
    // ever removed: a scan that misses a computed listener string costs sort
    // order, not access.
    const promoted = new Set(detected);
    if (detected.length > 0) out.set(USED_GROUP, detected);
    for (const type of DEMO_EVENT_TYPES) {
      if (promoted.has(type)) continue;
      const group = DEMO_EVENTS[type].group;
      out.set(group, [...(out.get(group) ?? []), type]);
    }
    return [...out.entries()];
  }, [detected]);

  const alertGroup =
    ALERT_BUTTON_GROUPS.find((g) => g.id === alertCategory) ?? ALERT_BUTTON_GROUPS[0];

  const variants = useMemo(() => {
    const defined = DEMO_EVENT_DEFS[selected].variants;
    return defined ? Object.entries(defined) : [];
  }, [selected]);

  function selectType(type: DemoEventType) {
    setSelected(type);
    setPayloadText(prettyPayload(type));
    setPayloadEdited(false);
  }

  /**
   * The author's edited payload when it applies to this fire, otherwise
   * undefined so the fixture gets rebuilt fresh (ids, timestamps) at delivery.
   * `false` means the edit is there but unusable, which stops the fire.
   */
  function resolveCustom(
    type: DemoEventType,
    variant?: string
  ): Record<string, unknown> | undefined | false {
    // A variant is a different payload for the same listener, so an edit made
    // against the default doesn't apply to it.
    if (variant || type !== selected || !payloadEdited) return undefined;
    try {
      const parsed = JSON.parse(payloadText) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        toast.error("Payload must be a JSON object");
        return false;
      }
      return parsed as Record<string, unknown>;
    } catch {
      toast.error("Payload isn't valid JSON");
      return false;
    }
  }

  function fire(type: DemoEventType, variant?: string) {
    const custom = resolveCustom(type, variant);
    if (custom === false) return;
    startSend(async () => {
      await onFire({ type, variant, custom });
    });
  }

  function stopSimulator(id: string) {
    stopFnsRef.current.get(id)?.();
    stopFnsRef.current.delete(id);
    setRunningIds((ids) => ids.filter((i) => i !== id));
  }

  function startSimulator(id: string) {
    const def = WIDGET_SIMULATORS[id];
    if (!def || stopFnsRef.current.has(id)) return;

    const stop = def.start((listener, event) => {
      // A simulator builds its own payload each tick, so it always travels as a
      // custom one rather than being rebuilt at the far end.
      if (!isDemoEventType(listener)) return;
      void onFire({ type: listener, custom: event }).then((ok) => {
        // Once delivery starts failing every following tick fails too, so stop
        // rather than log once a second.
        if (!ok) stopSimulator(id);
      });
    });

    stopFnsRef.current.set(id, stop);
    setRunningIds((ids) => [...ids, id]);
  }

  return (
    <div className={`shrink-0 border-b bg-background ${className ?? ""}`}>
      {/* Every alert the alert box can raise. Showing all 23 at once turned the
          bar into a wall, so they sit behind the same three groups the alert
          inspector uses -- one row at a time, and a streamer who learned the
          grouping in the inspector already knows this one. */}
      <div className="px-3 pt-1.5 pb-1.5 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-muted-foreground mr-0.5 shrink-0">Alerts</span>

        <ToggleGroup
          type="single"
          value={alertCategory}
          // Radix hands back "" when the active item is clicked again; keeping
          // the current group beats emptying the row.
          onValueChange={(v) => v && setAlertCategory(v as AlertEventCategoryId)}
          variant="outline"
          className="h-6"
        >
          {ALERT_BUTTON_GROUPS.map((group) => (
            <ToggleGroupItem
              key={group.id}
              value={group.id}
              className="h-6 px-2 text-[11px]"
            >
              {group.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Separator
          orientation="vertical"
          className="mx-0.5 data-[orientation=vertical]:h-4"
        />

        {alertGroup.events.map(({ type, variant, label, hint }) => (
          <Button
            key={label}
            size="sm"
            variant="outline"
            className="h-6 text-[11px] px-2"
            disabled={isSending}
            title={hint}
            aria-label={`Test the ${label} alert`}
            onClick={() => fire(type, variant)}
          >
            {label}
          </Button>
        ))}

        {/* The mode governs every test event in the editor, the alert box's own
            Test buttons included, so it reads once at the top rather than
            buried beside the picker.
            Local posts straight into the canvas previews; Live goes out over
            ws-server, which the canvas listens to as well, so the preview and
            every open overlay show the same event from one delivery. */}
        {changeMode && (
          <div className="ml-auto flex items-center rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => changeMode("local")}
              className={`text-[11px] px-2 py-0.5 transition-colors ${
                effectiveMode === "local" ? "bg-accent text-foreground" : "text-muted-foreground"
              }`}
            >
              Local
            </button>
            <button
              type="button"
              onClick={() => changeMode("live")}
              disabled={!liveAvailable}
              title={
                liveAvailable
                  ? "Send through the overlay server: this canvas and every overlay you have open"
                  : "Connect to live events first. Live sends through the overlay server."
              }
              className={`text-[11px] px-2 py-0.5 transition-colors disabled:opacity-40 ${
                effectiveMode === "live" ? "bg-accent text-foreground" : "text-muted-foreground"
              }`}
            >
              Live
            </button>
          </div>
        )}
      </div>

      {/* Everything else Twitch sends. Separated because it's the escape hatch,
          not the common path: custom widgets are written against the dedicated
          subscription types and need them reachable. */}
      <div className="px-3 py-1.5 flex items-center gap-1.5 flex-wrap border-t border-border/50">
        <span className="text-[10px] text-muted-foreground mr-0.5 shrink-0">Any event</span>

        <Select value={selected} onValueChange={(v) => selectType(v as DemoEventType)}>
          <SelectTrigger className="h-6 text-[11px] w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {grouped.map(([group, types]) => (
              <SelectGroup key={group}>
                <SelectLabel className="text-[10px]">{group}</SelectLabel>
                {types.map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    {DEMO_EVENTS[type].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          className="h-6 text-[11px] px-2"
          disabled={isSending}
          onClick={() => fire(selected)}
        >
          Fire
        </Button>

        {variants.map(([key, variant]) => (
          <Button
            key={key}
            size="sm"
            variant="outline"
            className="h-6 text-[11px] px-2"
            disabled={isSending}
            onClick={() => fire(selected, key)}
          >
            {variant.label}
          </Button>
        ))}

        <button
          type="button"
          onClick={() => setPayloadOpen((v) => !v)}
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {payloadOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Payload{payloadEdited ? " (edited)" : ""}
        </button>
      </div>

      {/* Looping sources. A one-shot shows what an event looks like; these show
          what the widget looks like while data keeps arriving. */}
      <div className="px-3 py-1.5 flex items-center gap-1.5 flex-wrap border-t border-border/50">
        <span className="text-[10px] text-muted-foreground mr-0.5 shrink-0">Simulate</span>
        {Object.values(WIDGET_SIMULATORS).map((def) => {
          const running = runningIds.includes(def.id);
          const tooFastForLive =
            effectiveMode === "live" && def.defaultIntervalMs < MIN_LIVE_INTERVAL_MS;
          return (
            <Button
              key={def.id}
              size="sm"
              variant={running ? "secondary" : "outline"}
              className="h-6 text-[11px] px-2"
              disabled={tooFastForLive && !running}
              title={
                tooFastForLive
                  ? "Too frequent to send live — switch to Local"
                  : def.description
              }
              onClick={() => (running ? stopSimulator(def.id) : startSimulator(def.id))}
            >
              {running ? (
                <Square className="mr-1 h-2.5 w-2.5" />
              ) : (
                <Play className="mr-1 h-2.5 w-2.5" />
              )}
              {def.label}
            </Button>
          );
        })}
        {runningIds.length > 0 && effectiveMode === "live" && (
          <span className="text-[10px] text-muted-foreground">
            Going to every overlay you have open
          </span>
        )}
      </div>

      {payloadOpen && (
        <div className="px-3 pb-2 space-y-1.5">
          <Textarea
            value={payloadText}
            onChange={(e) => {
              setPayloadText(e.target.value);
              setPayloadEdited(true);
            }}
            rows={8}
            spellCheck={false}
            className="font-mono text-[11px] leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[11px]"
              onClick={() => selectType(selected)}
            >
              Reset payload
            </Button>
            <span className="text-[10px] text-muted-foreground">
              Edits apply to {DEMO_EVENTS[selected].label} only.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
