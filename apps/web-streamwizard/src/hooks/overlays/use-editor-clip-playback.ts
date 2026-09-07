"use client";

import { useMemo } from "react";
import type { EditorClipPlaybackControls } from "@/components/overlays/registry/overlay-widget-registry.types";
import { useOverlayStore } from "@/stores/overlay-editor-store";

/**
 * Adapts the editor store's clip-preview flags to the control surface the clips
 * widget renderer expects, so the canvas doesn't carry eight pass-through
 * fields just to hand them straight back down.
 */
export function useEditorClipPlayback(): EditorClipPlaybackControls {
  const previewPaused = useOverlayStore((s) => s.editorClipPreviewPaused);
  const setPreviewPaused = useOverlayStore((s) => s.setEditorClipPreviewPaused);
  const previewForceMute = useOverlayStore((s) => s.editorClipPreviewForceMute);
  const setPreviewForceMute = useOverlayStore((s) => s.setEditorClipPreviewForceMute);
  const autoplayBlocked = useOverlayStore((s) => s.editorClipPreviewAutoplayBlocked);
  const setAutoplayBlocked = useOverlayStore((s) => s.setEditorClipPreviewAutoplayBlocked);
  const resumeTick = useOverlayStore((s) => s.editorClipPreviewResumeTick);
  const bumpResumePlayback = useOverlayStore((s) => s.bumpEditorClipPreviewResume);

  return useMemo(
    () => ({
      previewPaused,
      setPreviewPaused,
      previewForceMute,
      setPreviewForceMute,
      autoplayBlocked,
      setAutoplayBlocked,
      resumeTick,
      bumpResumePlayback,
    }),
    [
      previewPaused,
      setPreviewPaused,
      previewForceMute,
      setPreviewForceMute,
      autoplayBlocked,
      setAutoplayBlocked,
      resumeTick,
      bumpResumePlayback,
    ],
  );
}
