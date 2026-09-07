"use client";

import { useCallback, useEffect, useState } from "react";
import type { UnsavedChangesDialogProps } from "@/components/modals/unsaved-changes-dialog";

/**
 * Warns before unsaved work is thrown away.
 *
 * Covers the browser half itself — closing the tab, a reload, the browser's own
 * Back — by registering `beforeunload` while there is something to lose. That
 * prompt is the browser's, so it can't be styled or reworded.
 *
 * In-app navigation gets the real dialog: Next's client router can't be
 * intercepted, so hand the navigation to `requestLeave` and render
 * `<UnsavedChangesDialog {...dialogProps} />`. Clean state runs the action
 * straight away and never asks.
 */
export function useUnsavedChangesGuard(isDirty: boolean): {
  requestLeave: (action: () => void) => void;
  dialogProps: UnsavedChangesDialogProps;
} {
  // Held as a thunk so setState doesn't mistake the action for an updater.
  const [pending, setPending] = useState<{ run: () => void } | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const requestLeave = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }
      setPending({ run: action });
    },
    [isDirty]
  );

  const onOpenChange = useCallback((open: boolean) => {
    if (!open) setPending(null);
  }, []);

  const onConfirm = useCallback(() => {
    const action = pending?.run;
    setPending(null);
    action?.();
  }, [pending]);

  return {
    requestLeave,
    dialogProps: { open: pending !== null, onOpenChange, onConfirm },
  };
}
