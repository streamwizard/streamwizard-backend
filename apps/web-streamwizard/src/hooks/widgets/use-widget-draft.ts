"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { MutableRefObject } from "react";
import type { WidgetFieldSchema } from "@repo/ui/overlay";
import type { Widget } from "@/actions/widgets";
import { publishWidgetToLibrary, updateWidget } from "@/actions/widgets";
import { coerceFields } from "@/components/widgets/editor/widget-editor-fields";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

/**
 * The four editable sources. They live in refs, not state: Monaco owns the text
 * and re-rendering the editor on every keystroke would fight it. Anything that
 * needs to *react* to a change (the preview, the demo panel) is mirrored into
 * state deliberately, at the point it matters.
 *
 * Created and written by `useWidgetPreview` — the hot-reload path is the only
 * writer. Everyone else, this hook included, only reads them.
 */
export interface WidgetSources {
  html: MutableRefObject<string>;
  js: MutableRefObject<string>;
  css: MutableRefObject<string>;
  fieldsJson: MutableRefObject<string>;
}

/** Parses the Fields tab, or null when the author is mid-edit and it's invalid. */
export function parseFieldsJson(sources: WidgetSources): WidgetFieldSchema | null {
  try {
    return coerceFields(JSON.parse(sources.fieldsJson.current) as WidgetFieldSchema);
  } catch {
    return null;
  }
}

/**
 * The saveable document: sources, metadata, dirty tracking, and the two writes
 * (save, publish-to-library) plus the leave-guards that protect them.
 */
export function useWidgetDraft(
  widget: Widget,
  { sources, onSaved }: { sources: WidgetSources; onSaved: () => void },
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("from");

  const [name, setName] = useState(widget.name);
  // Widget metadata, saved with the code instead of only reaching the library
  // submission -- the widget row's own description and tags used to rot.
  const [description, setDescription] = useState(widget.description ?? "");
  const [tagsText, setTagsText] = useState(widget.tags?.join(", ") ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const { requestLeave, dialogProps: unsavedDialogProps } =
    useUnsavedChangesGuard(isDirty);
  const [isSaving, startSave] = useTransition();
  const [isPublishing, startPublish] = useTransition();

  function parsedTags(): string[] {
    return tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const handleSave = useCallback(() => {
    const fields = parseFieldsJson(sources);
    if (!fields) {
      toast.error("Fix the Fields JSON before saving");
      return;
    }
    startSave(async () => {
      const { error } = await updateWidget(widget.id, {
        name,
        description,
        tags: parsedTags(),
        html: sources.html.current,
        js: sources.js.current,
        extra_css: sources.css.current,
        fields,
      });
      if (error) {
        toast.error(error);
        return;
      }
      setIsDirty(false);
      onSaved();
      toast.success("Widget saved");
    });
    // handleSave is bound into a Monaco command once at mount; the refs it reads
    // are stable, and the state it reads is re-read via the latest closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, tagsText, widget.id, onSaved]);

  // Keep the Monaco keybinding pointed at the current closure without
  // re-registering the command on every keystroke.
  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  function publish(title: string, onDone: () => void) {
    startPublish(async () => {
      const { error } = await publishWidgetToLibrary(widget.id, {
        title,
        description,
        tags: parsedTags(),
      });
      if (error) {
        toast.error(error);
        return;
      }
      onDone();
      toast.success("Submitted for review");
    });
  }

  function handleBack() {
    requestLeave(() => {
      if (fromUrl && fromUrl.startsWith("/") && !fromUrl.startsWith("//") && !fromUrl.includes("\\")) {
        router.push(fromUrl);
        return;
      }
      router.back();
    });
  }

  return {
    name,
    setName,
    description,
    setDescription,
    tagsText,
    setTagsText,
    isDirty,
    markDirty: () => setIsDirty(true),
    isSaving,
    isPublishing,
    handleSave,
    handleSaveRef,
    publish,
    handleBack,
    unsavedDialogProps,
  };
}
