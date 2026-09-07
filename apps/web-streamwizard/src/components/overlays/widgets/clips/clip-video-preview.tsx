"use client";

import { Loader2 } from "lucide-react";
import { useClipFieldDrag } from "@/hooks/overlays/use-clip-field-drag";
import { useClipPlaylist } from "@/hooks/overlays/use-clip-playlist";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  DEFAULT_CLIPS_WIDGET_CONFIG,
  type ClipDisplayFieldLayout,
  type ClipsWidgetConfig,
  type DisplayFieldKey,
  resolvedDisplayFieldLocks,
  resolvedDisplayFieldOrder,
} from "@/types/overlays";
import { CLIP_NESTED_DISPLAY_FIELDS } from "./nested-fields";
import type { EditorClipPlaybackControls } from "../../registry/overlay-widget-registry.types";

interface ClipVideoPreviewProps {
  config: ClipsWidgetConfig;
  /** On-screen px per content px; editor chrome divides by it to stay legible. */
  screenScale: number;
  editable?: boolean;
  /** When set with `onSelectField`, selection is controlled by the parent (e.g. overlay editor store). */
  selectedFieldKey?: DisplayFieldKey | null;
  /** Editor-only: pause / force-mute / autoplay state lives in the overlay store (not persisted). */
  editorClipPlayback?: EditorClipPlaybackControls;
  onSelectField?: (field: DisplayFieldKey | null) => void;
  onUpdateDisplayFieldLayout?: (
    field: DisplayFieldKey,
    layout: Partial<ClipDisplayFieldLayout>
  ) => void;
}

export function ClipVideoPreview({
  config,
  screenScale,
  editable = false,
  selectedFieldKey: selectedFieldKeyProp,
  editorClipPlayback,
  onSelectField,
  onUpdateDisplayFieldLayout,
}: ClipVideoPreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [internalSelectedField, setInternalSelectedField] =
    useState<DisplayFieldKey | null>(null);
  const selectionControlled = editable && onSelectField !== undefined;
  const selectedField = selectionControlled
    ? (selectedFieldKeyProp ?? null)
    : internalSelectedField;
  const setSelectedField = useCallback(
    (field: DisplayFieldKey | null) => {
      if (selectionControlled) onSelectField?.(field);
      else setInternalSelectedField(field);
    },
    [selectionControlled, onSelectField]
  );
  // Only settings that affect clip selection/order should trigger a full reload.
  // Layout/display edits should not restart playback during drag.
  const displayFieldOrder = useMemo(
    () => resolvedDisplayFieldOrder(config),
    [config.displayFieldOrder]
  );

  const displayFieldLocksMap = useMemo(
    () => resolvedDisplayFieldLocks(config),
    [config.displayFieldLocks]
  );

  const {
    clips,
    currentClip,
    loading,
    activePlayer,
    videoRefA,
    videoRefB,
    videoOpacityTransitionStyle,
    mediaShouldPlay,
    muted,
    previewEditor,
    playNext,
  } = useClipPlaylist({ config, editorClipPlayback });

  const getFieldLayout = useCallback(
    (field: DisplayFieldKey): ClipDisplayFieldLayout =>
      config.displayFieldLayouts?.[field] ?? DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLayouts[field],
    [config.displayFieldLayouts],
  );

  const { fieldDrag, startFieldDrag } = useClipFieldDrag({
    editable,
    rootRef,
    displayFieldLocks: displayFieldLocksMap,
    getFieldLayout,
    onUpdateDisplayFieldLayout,
    onSelectField: setSelectedField,
  });

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/80">
        <Loader2 className="h-6 w-6 text-white/60 animate-spin" />
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/80">
        <span className="text-white/50 text-center px-2" style={{ fontSize: Math.max(10 / screenScale, 12) }}>
          No clips match filters
        </span>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="group w-full h-full relative bg-black overflow-hidden"
      onClick={() => {
        if (editable) setSelectedField(null);
      }}
    >
      {/* Dual video players */}
      <video
        ref={videoRefA}
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          opacity: activePlayer === 0 ? 1 : 0,
          zIndex: activePlayer === 0 ? 1 : 0,
          ...videoOpacityTransitionStyle,
        }}
        muted={muted}
        playsInline
        onEnded={playNext}
        onCanPlay={() => {
          if (activePlayer === 0 && mediaShouldPlay) {
            videoRefA.current?.play().catch((err) => {
              if (
                previewEditor &&
                err instanceof DOMException &&
                err.name === "NotAllowedError"
              ) {
                editorClipPlayback?.setAutoplayBlocked(true);
              }
            });
          }
        }}
        onError={() => {
          if (activePlayer === 0) playNext();
        }}
      />
      <video
        ref={videoRefB}
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          opacity: activePlayer === 1 ? 1 : 0,
          zIndex: activePlayer === 1 ? 1 : 0,
          ...videoOpacityTransitionStyle,
        }}
        muted={muted}
        playsInline
        onEnded={playNext}
        onCanPlay={() => {
          if (activePlayer === 1 && mediaShouldPlay) {
            videoRefB.current?.play().catch((err) => {
              if (
                previewEditor &&
                err instanceof DOMException &&
                err.name === "NotAllowedError"
              ) {
                editorClipPlayback?.setAutoplayBlocked(true);
              }
            });
          }
        }}
        onError={() => {
          if (activePlayer === 1) playNext();
        }}
      />

      {/* Clip field sublayers (independent, draggable, resizable) */}
      {currentClip && (
        <>
          {(Object.entries(config.displayFields) as [DisplayFieldKey, boolean][])
            .filter(([_, enabled]) => enabled)
            .sort(
              (a, b) =>
                displayFieldOrder.indexOf(a[0]) -
                displayFieldOrder.indexOf(b[0])
            )
            .map(([field]) => {
              const layout = getFieldLayout(field);
              const isSelectedField = selectedField === field;
              const fieldDef = CLIP_NESTED_DISPLAY_FIELDS[field];
              const value = fieldDef.formatPreviewText(currentClip);
              const locked = displayFieldLocksMap[field];
              const stackZ = 2 + displayFieldOrder.indexOf(field);
              if (!value) return null;

              return (
                <div
                  key={field}
                  className={`absolute text-white/90 px-1 rounded ${
                    editable && isSelectedField
                      ? "ring-1 ring-primary bg-black/35"
                      : "bg-black/25"
                  }`}
                  style={{
                    left: `${layout.x}%`,
                    top: `${layout.y}%`,
                    width: `${layout.w}%`,
                    height: `${layout.h}%`,
                    zIndex: stackZ,
                    fontSize: `${layout.fontSize}px`,
                    lineHeight: 1.2,
                    overflow: "hidden",
                    cursor:
                      editable && !locked ? "move" : "default",
                  }}
                  onMouseDown={(e) => startFieldDrag(e, field, "move")}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editable) setSelectedField(field);
                  }}
                >
                  {fieldDef.renderPreview ? (
                    fieldDef.renderPreview(value)
                  ) : (
                    <div className="truncate">{value}</div>
                  )}
                  {editable && isSelectedField && !locked && (
                    <div
                      className="absolute w-2.5 h-2.5 rounded-sm bg-primary right-0 bottom-0 cursor-se-resize"
                      onMouseDown={(e) => startFieldDrag(e, field, "resize")}
                    />
                  )}
                </div>
              );
            })}
        </>
      )}

    </div>
  );
}
