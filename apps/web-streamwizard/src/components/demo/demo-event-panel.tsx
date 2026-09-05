"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, Play, Square, Zap } from "lucide-react";
import {
  DEMO_EVENTS,
  DEMO_EVENT_DEFS,
  DEMO_EVENT_TYPES,
  isDemoEventType,
  type DemoEventType,
} from "@repo/schemas";
import type { DemoFireRequest, FireMode } from "./demo-fire";
import { simulatorItemState } from "./simulator-availability";
import {
  ALERT_EVENT_CATEGORIES,
  ALERT_EVENT_LABELS,
  ALERT_EVENT_SUBSCRIPTION_TYPES,
  WIDGET_SIMULATORS,
  scanWidgetListeners,
  type AlertEventCategoryId,
} from "@repo/ui/overlay";
import {
  Button,
  ButtonGroup,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
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

/** Picker group holding the events the widget's own source references. */
const USED_GROUP = "Used by this widget";

/**
 * cmdk's default scorer is fuzzy enough that "raid" matches "Reward redeemed"
 * and half the catalogue. Substring on the type and label is what people
 * expect from a list this small; a prefix hit sorts first.
 */
function filterEvent(value: string, search: string, keywords?: string[]): number {
  const q = search.trim().toLowerCase();
  if (!q) return 1;
  const fields = [value, ...(keywords ?? [])].map((f) => f.toLowerCase());
  if (fields.some((f) => f.startsWith(q))) return 2;
  return fields.some((f) => f.includes(q)) ? 1 : 0;
}

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
    // corrupt or unavailable storage -- start clean
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
      // storage full or blocked -- persistence is a nicety, not a requirement
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

  const eventLabel = DEMO_EVENTS[selected].label;
  const runningCount = runningIds.length;

  return (
    <div className={`shrink-0 border-b bg-background ${className ?? ""}`}>
      {/* One row. The alert buttons are what a streamer reaches for most, so
          they stay flat; the full event catalogue and the looping simulators
          are the escape hatches, folded behind one trigger each so the bar
          stays a bar instead of three of them. Wrapping is the fallback for
          the widget editor's narrower pane. */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5">
        {/* Every alert the alert box can raise. Showing all 23 at once turned
            the bar into a wall, so they sit behind the same three groups the
            alert inspector uses -- one group at a time, and a streamer who
            learned the grouping in the inspector already knows this one. */}
        <span className="mr-0.5 shrink-0 text-[10px] text-muted-foreground">Alerts</span>

        <ToggleGroup
          type="single"
          value={alertCategory}
          // Radix hands back "" when the active item is clicked again; keeping
          // the current group beats emptying the row.
          onValueChange={(v) => v && setAlertCategory(v as AlertEventCategoryId)}
          variant="outline"
          className="h-7"
        >
          {ALERT_BUTTON_GROUPS.map((group) => (
            <ToggleGroupItem key={group.id} value={group.id} className="h-7 px-2 text-xs">
              {group.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Separator orientation="vertical" className="mx-0.5 data-[orientation=vertical]:h-4" />

        {alertGroup.events.map(({ type, variant, label, hint }) => (
          <Button
            key={label}
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={isSending}
            title={hint}
            aria-label={`Test the ${label} alert`}
            onClick={() => fire(type, variant)}
          >
            {label}
          </Button>
        ))}

        <Separator orientation="vertical" className="mx-0.5 data-[orientation=vertical]:h-4" />

        {/* Everything else Twitch and StreamWizard send. A split button: the
            left half fires whatever was picked last, so a custom widget's one
            event stays a single click; the chevron opens the picker, the
            variants and the payload editor. Custom widgets are written against
            the dedicated subscription types and need them reachable. */}
        <span className="mr-0.5 shrink-0 text-[10px] text-muted-foreground">Any event</span>

        <Popover>
          <ButtonGroup aria-label="Any event">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={isSending}
              title={
                payloadEdited ? `Fire ${eventLabel} with your edited payload` : `Fire ${eventLabel}`
              }
              onClick={() => fire(selected)}
            >
              <Zap className="size-3" />
              <span className="max-w-44 truncate">{eventLabel}</span>
            </Button>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="relative h-7 w-7"
                aria-label="Pick an event or edit its payload"
                title="Pick an event or edit its payload"
              >
                <ChevronDown className="size-3" />
                {payloadEdited && (
                  <>
                    <span
                      aria-hidden
                      className="absolute right-1 top-1 size-1.5 rounded-full bg-primary"
                    />
                    <span className="sr-only">Payload edited</span>
                  </>
                )}
              </Button>
            </PopoverTrigger>
          </ButtonGroup>

          {/* Edge to edge: the search input is the popover's top edge and the
              actions sit in a footer, so it reads as one surface rather than
              a list boxed inside a card. */}
          <PopoverContent
            align="start"
            className="w-96 max-h-(--radix-popover-content-available-height) overflow-y-auto p-0"
          >
            {/* Search-first: seventy-odd events is too many to scroll. The
                item value is the subscription type and the label is a keyword,
                so "follow" and "channel.follow" both land. The popover remounts
                this on every open, so defaultValue re-highlights the current
                pick each time. */}
            <Command defaultValue={selected} filter={filterEvent} className="rounded-none">
              <CommandInput placeholder="Search events" className="h-8 text-xs" />
              <CommandList className="max-h-56">
                <CommandEmpty className="py-4 text-xs text-muted-foreground">
                  No events match.
                </CommandEmpty>
                {grouped.map(([group, types]) => (
                  <CommandGroup key={group} heading={group}>
                    {types.map((type) => (
                      <CommandItem
                        key={type}
                        value={type}
                        keywords={[DEMO_EVENTS[type].label]}
                        className="py-1 text-xs"
                        // Re-picking the current event must not throw away an
                        // edited payload.
                        onSelect={() => type !== selected && selectType(type)}
                      >
                        <Check
                          className={`size-3 ${type === selected ? "opacity-100" : "opacity-0"}`}
                        />
                        <span className="truncate">{DEMO_EVENTS[type].label}</span>
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                          {type}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>

            <div className="space-y-3 border-t p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={isSending}
                  onClick={() => fire(selected)}
                >
                  <Zap className="size-3" />
                  Fire {eventLabel}
                </Button>
                {variants.map(([key, variant]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={isSending}
                    onClick={() => fire(selected, key)}
                  >
                    {variant.label}
                  </Button>
                ))}
              </div>

              <Collapsible open={payloadOpen} onOpenChange={setPayloadOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="-ml-1.5 h-7 px-1.5 text-xs text-muted-foreground"
                  >
                    {payloadOpen ? (
                      <ChevronDown className="size-3" />
                    ) : (
                      <ChevronRight className="size-3" />
                    )}
                    Payload{payloadEdited ? " (edited)" : ""}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1.5 pt-1.5">
                  <Textarea
                    value={payloadText}
                    onChange={(e) => {
                      setPayloadText(e.target.value);
                      setPayloadEdited(true);
                    }}
                    rows={8}
                    spellCheck={false}
                    className="max-h-72 font-mono text-[11px] leading-relaxed"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => selectType(selected)}
                    >
                      Reset payload
                    </Button>
                    <span className="text-[10px] text-muted-foreground">
                      Edits apply to {eventLabel} only.
                    </span>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </PopoverContent>
        </Popover>

        {/* Looping sources. A one-shot shows what an event looks like; these
            show what the widget looks like while data keeps arriving. Items
            toggle without closing the menu, so starting a second loop is one
            more click, and the trigger carries the running count so a hidden
            loop is never a mystery. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant={runningCount > 0 ? "secondary" : "outline"}
              className="h-7 px-2 text-xs"
              title="Loop fake data into your widgets"
            >
              <Play className="size-3" />
              Simulate
              {runningCount > 0 && (
                <span className="rounded-full bg-primary/15 px-1.5 text-[10px] leading-4 text-primary">
                  {runningCount}
                </span>
              )}
              <ChevronDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            {Object.values(WIDGET_SIMULATORS).map((def) => {
              const running = runningIds.includes(def.id);
              const { disabled, hint } = simulatorItemState({
                mode: effectiveMode,
                running,
                intervalMs: def.defaultIntervalMs,
                description: def.description,
              });
              return (
                <DropdownMenuItem
                  key={def.id}
                  disabled={disabled}
                  className="items-start gap-2"
                  title={hint}
                  onSelect={(event) => {
                    // Keep the menu open: a second simulator is one click away.
                    event.preventDefault();
                    if (running) stopSimulator(def.id);
                    else startSimulator(def.id);
                  }}
                >
                  {running ? (
                    <Square className="mt-0.5 size-3.5" />
                  ) : (
                    <Play className="mt-0.5 size-3.5" />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="text-xs">{def.label}</span>
                    <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {hint}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
            {runningCount > 0 && effectiveMode === "live" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                  Going to every overlay you have open
                </DropdownMenuLabel>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* The mode governs every test event in the editor, the alert box's own
            Test buttons included, so it reads once at the end of the row rather
            than buried beside the picker.
            Local posts straight into the canvas previews; Live goes out over
            ws-server, which the canvas listens to as well, so the preview and
            every open overlay show the same event from one delivery. */}
        {changeMode && (
          <ToggleGroup
            type="single"
            value={effectiveMode}
            onValueChange={(v) => v && changeMode(v as FireMode)}
            variant="outline"
            className="ml-auto h-7"
            aria-label="Where test events go"
          >
            <ToggleGroupItem
              value="local"
              className="h-7 px-2 text-xs"
              title="Stay in this tab. Events go straight into the canvas."
            >
              Local
            </ToggleGroupItem>
            <ToggleGroupItem
              value="live"
              className="h-7 px-2 text-xs"
              disabled={!liveAvailable}
              title={
                liveAvailable
                  ? "Send through the overlay server: this canvas and every overlay you have open"
                  : "Connect to live events first. Live sends through the overlay server."
              }
            >
              Live
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>
    </div>
  );
}
