"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AlertScene } from "@repo/alert-scene";
import type { AlertEventType } from "@repo/ui/overlay";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  TooltipProvider,
} from "@repo/ui";
import { DiscardChangesDialog } from "./discard-changes-dialog";
import { cancelActiveDrag } from "./drag-registry";
import { InspectorPanel } from "./inspector/inspector-panel";
import { loadTimelineLayout, saveTimelineLayout, type PanelLayout } from "./layout-preferences";
import { PreviewPane } from "./preview/preview-pane";
import { PlaybackProvider, TimelineStoreProvider, TimelineViewProvider, useTimeline, useTimelineStoreApi } from "./timeline-context";
import { TimelineSection } from "./timeline-section";
import { createTimelineStore } from "./timeline-store";
import { useEditorPlayback } from "./use-editor-playback";
import { useTimelineShortcuts, type ShortcutKeyEvent } from "./use-timeline-shortcuts";
import { useTimelineViewController } from "./use-timeline-view";

function pick(e: KeyboardEvent): Omit<ShortcutKeyEvent, "currentTarget" | "target"> {
  return {
    key: e.key,
    metaKey: e.metaKey,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    preventDefault: () => e.preventDefault(),
    stopPropagation: () => e.stopPropagation(),
  };
}

export interface AlertTimelineDialogProps {
  event: AlertEventType;
  eventLabel: string;
  initialScene: AlertScene;
  /** False for a freshly seeded timeline the alert box does not hold yet. */
  saved: boolean;
  onSave: (scene: AlertScene) => void;
  onClose: () => void;
}

/**
 * The timeline editor. Mount it to open, unmount on `onClose`: the store,
 * clock, media elements and observers all live and die with this component,
 * so fifty open/close cycles leave nothing behind.
 *
 * Portaled to <body> by Radix at the repo's single portal lane (z-50). Every
 * nested surface (select lists, the discard dialog) mounts later in the DOM
 * and therefore stacks above without a higher z-index.
 */
export function AlertTimelineDialog(props: AlertTimelineDialogProps) {
  const [store] = useState(() => createTimelineStore(props.initialScene, { saved: props.saved }));
  return (
    <TimelineStoreProvider value={store}>
      <Providers {...props} />
    </TimelineStoreProvider>
  );
}

function Providers(props: AlertTimelineDialogProps) {
  const paneRef = useRef<HTMLDivElement>(null);
  const playback = useEditorPlayback(paneRef);
  const view = useTimelineViewController(paneRef);
  return (
    <PlaybackProvider value={playback}>
      <TimelineViewProvider value={view}>
        <TooltipProvider delayDuration={400}>
          <EditorDialog {...props} paneRef={paneRef} />
        </TooltipProvider>
      </TimelineViewProvider>
    </PlaybackProvider>
  );
}

function EditorDialog({
  event,
  eventLabel,
  onSave,
  onClose,
  paneRef,
}: AlertTimelineDialogProps & { paneRef: React.RefObject<HTMLDivElement | null> }) {
  const api = useTimelineStoreApi();
  const dirty = useTimeline((s) => s.dirty);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [layout] = useState(loadTimelineLayout);

  const save = useCallback(() => {
    const s = api.getState();
    s.setPlaying(false);
    onSave(s.scene);
    s.markSaved();
    onClose();
  }, [api, onSave, onClose]);

  const requestClose = useCallback(() => {
    if (api.getState().dirty) setConfirmOpen(true);
    else onClose();
  }, [api, onClose]);

  const onKeyDown = useTimelineShortcuts({ onSave: save });
  const contentRef = useRef<HTMLDivElement>(null);

  // Focus can still land on <body> (a closed popover, a blurred control). The
  // trap does not pull it back, so keys typed there are forwarded here.
  useEffect(() => {
    const onDocumentKeyDown = (e: KeyboardEvent) => {
      const content = contentRef.current;
      if (!content || document.activeElement !== document.body) return;
      onKeyDown({ ...pick(e), currentTarget: content, target: content });
    };
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => document.removeEventListener("keydown", onDocumentKeyDown);
  }, [onKeyDown]);

  const persistRows = (rows: PanelLayout) => saveTimelineLayout({ ...loadTimelineLayout(), rows });
  const persistColumns = (columns: PanelLayout) => saveTimelineLayout({ ...loadTimelineLayout(), columns });

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && requestClose()}>
        <DialogContent
          ref={contentRef}
          showCloseButton={false}
          className="flex h-[90vh] w-[92vw] max-w-[92vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[92vw]"
          onKeyDown={onKeyDown}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            // Mid-drag, Escape only cancels the drag.
            if (cancelActiveDrag()) return;
            requestClose();
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            paneRef.current?.focus({ preventScroll: true });
          }}
        >
          <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
            <DialogTitle className="text-sm font-semibold">
              Timeline <span className="text-muted-foreground">·</span> {eventLabel}
              {dirty && <span className="ml-2 inline-block size-1.5 rounded-full bg-primary align-middle" aria-label="Unsaved changes" />}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Compose the {eventLabel} alert on a timeline. Space plays, Escape closes, Ctrl+S saves to the alert box.
            </DialogDescription>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={requestClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty}>
              Save to alert box
            </Button>
          </header>

          <div className="min-h-0 flex-1">
            <ResizablePanelGroup orientation="vertical" defaultLayout={layout.rows} onLayoutChanged={persistRows}>
              <ResizablePanel id="top" minSize="25%" className="min-h-0">
                <ResizablePanelGroup orientation="horizontal" defaultLayout={layout.columns} onLayoutChanged={persistColumns}>
                  <ResizablePanel id="preview" minSize="35%" className="min-h-0 min-w-0">
                    <PreviewPane event={event} />
                  </ResizablePanel>
                  <ResizableHandle />
                  <ResizablePanel id="inspector" minSize={240} className="min-h-0 min-w-0 border-l bg-background">
                    <InspectorPanel />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel id="timeline" minSize={160} className="min-h-0 border-t">
                <TimelineSection />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </DialogContent>
      </Dialog>
      <DiscardChangesDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          paneRef.current?.focus({ preventScroll: true });
        }}
        onDiscard={() => {
          setConfirmOpen(false);
          onClose();
        }}
      />
    </>
  );
}
