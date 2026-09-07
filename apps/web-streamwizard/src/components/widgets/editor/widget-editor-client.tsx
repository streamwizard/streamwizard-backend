"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { OnMount, Monaco } from "@monaco-editor/react";
import type { Widget } from "@/actions/widgets";
import { env } from "@/lib/env";
import { WIDGET_EDITOR_DECLARATIONS, WIDGET_EDITOR_LIB_DECLARATIONS, DEMO_EVENT_TYPES } from "@repo/schemas";
import { CustomWidgetIframe, scanWidgetListeners } from "@repo/ui/overlay";
import { AssetPickerDialog } from "@/components/media/asset-picker-dialog";
import { UnsavedChangesDialog } from "@/components/modals/unsaved-changes-dialog";
import { DemoEventPanel } from "@/components/demo/demo-event-panel";
import {
  demoFirePayload,
  sendDemoEventLive,
  type DemoFireRequest,
} from "@/components/demo/demo-fire";
import { WidgetFieldsPanel } from "@/components/widgets/editor/widget-fields-panel";
import { WidgetConsolePanel } from "@/components/widgets/editor/widget-console-panel";
import {
  WIDGET_FIELDS_JSON_SCHEMA,
  WIDGET_FIELDS_SCHEMA_URI,
} from "@/components/widgets/editor/widget-fields-json-schema";
import { EDITOR_OPTIONS, registerEmmetProviders } from "@/components/widgets/editor/widget-editor-monaco";
import { useWidgetConsole } from "@/hooks/widgets/use-widget-console";
import { useWidgetDraft, type WidgetSources } from "@/hooks/widgets/use-widget-draft";
import { useWidgetLiveRoom } from "@/hooks/widgets/use-widget-live-room";
import { useWidgetPreview, type EditorTab } from "@/hooks/widgets/use-widget-preview";
import { ImagePlus, Info } from "lucide-react";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { Switch } from "@repo/ui";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui";
import { Textarea } from "@repo/ui";

// Self-hosted Monaco + Tailwind language service. Importing the wrapper rather
// than @monaco-editor/react directly guarantees setupMonaco() runs before the
// editor asks the loader for an instance. See src/lib/monaco/setup.ts.
const MonacoEditor = dynamic(() => import("@/lib/monaco/editor"), {
  ssr: false,
});



export function WidgetEditorClient({ widget }: { widget: Widget }) {
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTitle, setPublishTitle] = useState(widget.name);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [legacyDemoDismissed, setLegacyDemoDismissed] = useState(false);
  const [fieldsPanelOpen, setFieldsPanelOpen] = useState(true);

  // Monaco owns the editor text; these refs are what it writes into, and what
  // save and the preview rebuild read back. The container is memoised so it is
  // one stable object rather than a fresh render-local that handlers mutate.
  const htmlRef = useRef(widget.html);
  const jsRef = useRef(widget.js);
  const cssRef = useRef(widget.extra_css);
  const fieldsJsonRef = useRef(JSON.stringify(widget.fields, null, 2));
  const sources: WidgetSources = { html: htmlRef, js: jsRef, css: cssRef, fieldsJson: fieldsJsonRef };
  const [activeTab, setActiveTab] = useState<EditorTab>("html");
  const [editorDefaultValue, setEditorDefaultValue] = useState(widget.html);
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  const preview = useWidgetPreview({ widget, sources });
  const draft = useWidgetDraft(widget, { sources, onSaved: preview.refreshPreview });
  const widgetConsole = useWidgetConsole();
  const liveRoom = useWidgetLiveRoom();

  const {
    name,
    setName,
    description,
    setDescription,
    tagsText,
    setTagsText,
    isDirty,
    isSaving,
    isPublishing,
    handleSave,
    handleSaveRef,
    handleBack,
    unsavedDialogProps,
  } = draft;
  const {
    widgetRef,
    refreshKey,
    srcdoc,
    fieldData,
    fieldsSchema,
    fieldOverrides,
    jsSource,
    refreshPreview,
    setFieldOverride,
    scheduleHotReload,
    fireTestEvent,
  } = preview;
  const { logs, setLogs, consoleOpen, setConsoleOpen, appendLog } = widgetConsole;
  const { room: wsRoom, status: wsStatus, setStatus: setWsStatus, enabled: wsEnabled, toggle: toggleWs } = liveRoom;

  // Flags the pattern Demo mode replaces, so authors know the field and the
  // fake-data loop in their own script are now dead weight.
  const legacyDemo = useMemo(() => {
    if (legacyDemoDismissed) return null;
    return scanWidgetListeners(jsSource, DEMO_EVENT_TYPES).legacyDemo;
  }, [jsSource, legacyDemoDismissed]);

  /**
   * Delivery for the demo bar. There is no scene here, only this widget's
   * preview iframe, so Local posts straight into it. Live goes out over the
   * same server path the overlay editor uses, and the iframe picks it back up
   * off the room it is already joined to.
   */
  const fireDemo = useCallback(
    async (request: DemoFireRequest) => {
      if (!wsEnabled) {
        fireTestEvent(request.type, demoFirePayload(request));
        return true;
      }
      return sendDemoEventLive(request);
    },
    [wsEnabled, fireTestEvent]
  );

  function insertAssetUrl(url: string) {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    // executeEdits fires onChange, which marks dirty and hot-reloads the preview
    editor.executeEdits("asset-picker", [{ range: selection, text: url, forceMoveMarkers: true }]);
    editor.focus();
  }

  function handleEditorChange(value: string | undefined) {
    const val = value ?? "";
    draft.markDirty();

    let validChange = true;
    if (activeTab === "html") htmlRef.current = val;
    else if (activeTab === "js") jsRef.current = val;
    else if (activeTab === "css") cssRef.current = val;
    else {
      fieldsJsonRef.current = val;
      try {
        JSON.parse(val);
        setFieldsError(null);
      } catch {
        setFieldsError("Invalid JSON");
        validChange = false;
      }
    }

    if (validChange) scheduleHotReload(activeTab);
  }

  /**
   * Seeds the Monaco model for a tab. Monaco keeps one model per `path` and only
   * reads `defaultValue` when it creates one, so this is snapshotted on the tab
   * switch itself rather than read out of the ref every render.
   */
  function selectTab(next: EditorTab) {
    const buffer =
      next === "html"
        ? htmlRef.current
        : next === "js"
          ? jsRef.current
          : next === "fields"
            ? fieldsJsonRef.current
            : cssRef.current;
    setEditorDefaultValue(buffer);
    setActiveTab(next);
  }

  function handlePublish() {
    draft.publish(publishTitle, () => setPublishOpen(false));
  }

  const handleMount: OnMount = useCallback((editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;

    // StreamWizard type definitions for the JS tab
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      WIDGET_EDITOR_DECLARATIONS,
      "streamwizard-api.d.ts"
    );
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      WIDGET_EDITOR_LIB_DECLARATIONS,
      "streamwizard-libs.d.ts"
    );

    // JSON schema validation + completion for the fields tab. `path="fields"`
    // on the editor produces the model uri this matches on.
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [
        {
          uri: WIDGET_FIELDS_SCHEMA_URI,
          fileMatch: ["fields"],
          schema: WIDGET_FIELDS_JSON_SCHEMA,
        },
      ],
    });

    // Emmet completions for HTML and CSS
    registerEmmetProviders(monaco);

    // Ctrl/Cmd+S saves. Formatting keeps Monaco's own Shift+Alt+F.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveRef.current();
    });
  }, [handleSaveRef]);

  const editorLanguage: Record<typeof activeTab, string> = {
    html: "html",
    js: "javascript",
    fields: "json",
    css: "css",
  };

  return (
    <div className="flex flex-col -mx-5 -my-5 md:-my-6 h-[calc(100vh-var(--header-height))]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background shrink-0">
        <button
          onClick={handleBack}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); draft.markDirty(); }}
          className="h-8 text-sm w-48"
        />
        <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 text-xs">
              Details
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); draft.markDirty(); }}
                rows={3}
                placeholder="What does this widget do?"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Tags (comma separated)</label>
              <Input
                value={tagsText}
                onChange={(e) => { setTagsText(e.target.value); draft.markDirty(); }}
                placeholder="irl, speed, overlay"
              />
            </div>
            <p className="text-xs text-muted-foreground">Saved with the widget.</p>
          </PopoverContent>
        </Popover>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={`${env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.streamwizard.org"}/overlays/widgets`}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent transition-colors text-muted-foreground"
            title="Widget API reference"
          >
            Docs
          </a>
          {/* One switch for the whole live story: the ws connection and where
              the demo panel's events go (through ws-server vs. into the iframe). */}
          <label
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent transition-colors cursor-pointer"
            title={
              wsEnabled
                ? "Live: real Twitch events stream in, demo events go through the overlay server"
                : "Go live — stream in real Twitch events and send demo events through the overlay server"
            }
          >
            <span
              className={
                wsStatus === "connected"
                  ? "h-2 w-2 rounded-full bg-green-500"
                  : wsStatus === "connecting"
                  ? "h-2 w-2 rounded-full bg-yellow-400 animate-pulse"
                  : "h-2 w-2 rounded-full bg-zinc-500"
              }
            />
            {wsStatus === "connecting" ? "Connecting…" : "Live"}
            <Switch checked={wsEnabled} onCheckedChange={() => toggleWs()} className="scale-75" />
          </label>
          <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                Publish to Library
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish Widget</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Title</label>
                  <Input
                    value={publishTitle}
                    onChange={(e) => setPublishTitle(e.target.value)}
                  />
                </div>
                {/* Description and tags come from the widget's own details, so
                    the library entry and the widget row can't disagree. */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); draft.markDirty(); }}
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    Tags (comma separated)
                  </label>
                  <Input
                    value={tagsText}
                    onChange={(e) => { setTagsText(e.target.value); draft.markDirty(); }}
                    placeholder="irl, speed, overlay"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Your widget will be reviewed before appearing in the library.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPublishOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handlePublish} disabled={isPublishing}>
                    Submit for Review
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !isDirty || !!fieldsError}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Editor + Preview split */}
      <div className="flex flex-1 min-h-0">
        {/* Left: code tabs */}
        <div className="flex flex-col w-1/2 border-r min-h-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => selectTab(v as EditorTab)}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="shrink-0 rounded-none border-b h-9 justify-start px-2 gap-1">
              <TabsTrigger value="html" className="text-xs h-7">HTML</TabsTrigger>
              <TabsTrigger value="js" className="text-xs h-7">JS</TabsTrigger>
              <TabsTrigger value="fields" className="text-xs h-7">
                Fields {fieldsError && <span className="ml-1 text-destructive">!</span>}
              </TabsTrigger>
              <TabsTrigger value="css" className="text-xs h-7">Extra CSS</TabsTrigger>
              <button
                type="button"
                onClick={() => setAssetPickerOpen(true)}
                className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
                title="Insert a media-library file URL at the cursor"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Insert asset
              </button>
            </TabsList>

            <div className="flex-1 min-h-0">
              <MonacoEditor
                height="100%"
                theme="vs-dark"
                language={editorLanguage[activeTab]}
                defaultValue={editorDefaultValue}
                onChange={handleEditorChange}
                onMount={handleMount}
                options={EDITOR_OPTIONS}
                path={activeTab}
              />
            </div>
          </Tabs>
        </div>

        {/* Right: sandboxed preview */}
        <div
          className="flex flex-col w-1/2 min-h-0"
          style={{
            backgroundColor: "#1a1a1a",
            backgroundImage:
              "linear-gradient(45deg,#2a2a2a 25%,transparent 25%),linear-gradient(-45deg,#2a2a2a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a2a 75%),linear-gradient(-45deg,transparent 75%,#2a2a2a 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
          }}
        >
          <div className="shrink-0 px-3 py-1.5 border-b bg-background flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Preview</span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => setFieldsPanelOpen((v) => !v)}
              >
                {fieldsPanelOpen ? "Hide fields" : "Fields"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => refreshPreview()}
              >
                Refresh
              </Button>
            </div>
          </div>

          <DemoEventPanel
            storageId={widget.id}
            sourceJs={jsSource}
            wsConnected={wsStatus === "connected"}
            mode={wsEnabled ? "live" : "local"}
            onFire={fireDemo}
          />

          {legacyDemo && (
            <div className="shrink-0 border-b bg-amber-500/5 px-3 py-1.5">
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0 opacity-80" aria-hidden />
                <span>
                  This widget ships its own demo mode (
                  {legacyDemo.hits.map((hit, i) => (
                    <span key={hit}>
                      {i > 0 && ", "}
                      <code className="text-foreground/80">{hit}</code>
                    </span>
                  ))}
                  ). Demo mode above replaces it — you can drop that code and its field.
                </span>
                <button
                  type="button"
                  onClick={() => setLegacyDemoDismissed(true)}
                  className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </button>
              </p>
            </div>
          )}

          <div className="flex flex-1 min-h-0">
            <CustomWidgetIframe
              key={refreshKey}
              ref={widgetRef}
              srcdoc={srcdoc}
              fieldData={fieldData}
              wsRoom={wsRoom}
              onWsStatus={setWsStatus}
              onLog={appendLog}
              className="flex-1 min-w-0"
              title="Widget preview"
            />
            {fieldsPanelOpen && (
              <WidgetFieldsPanel
                fields={fieldsSchema}
                overrides={fieldOverrides}
                onChange={setFieldOverride}
                onReset={() => refreshPreview({})}
              />
            )}
          </div>

          <WidgetConsolePanel
            logs={logs}
            open={consoleOpen}
            onToggle={() => setConsoleOpen((v) => !v)}
            onClear={() => setLogs([])}
          />
        </div>
      </div>

      <AssetPickerDialog
        open={assetPickerOpen}
        onOpenChange={setAssetPickerOpen}
        onSelect={(asset) => insertAssetUrl(asset.url)}
        title="Insert asset"
      />

      <UnsavedChangesDialog {...unsavedDialogProps} />
    </div>
  );
}
