"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent } from "@repo/ui";
import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import {
  getMyChannelInfo,
  updateChannelInfo,
  type ChannelInfoResult,
} from "@/actions/twitch/channels";
import type { SaveBarActions, SaveBarState } from "@/components/deck/switcher-settings-panel";
import { CategoryPicker } from "@/components/deck/stream-info/category-picker";
import { TitleField } from "@/components/deck/stream-info/title-field";

/**
 * Title and category editing on the deck.
 *
 * Loads live from Helix rather than from our own tables: the streamer may have
 * changed either from the Twitch app since we last saw a `channel.update`, and
 * an editor that opens on a stale title will write that stale title straight
 * back the next time it saves.
 */

interface DeckStreamPanelProps {
  broadcasterId: string | null;
  canInteract: boolean;
  onSaveBarChange: (state: SaveBarState) => void;
  actionsRef: React.MutableRefObject<SaveBarActions | null>;
}

interface Category {
  id: string;
  name: string;
  boxArtUrl?: string;
}

export function DeckStreamPanel({
  broadcasterId,
  canInteract,
  onSaveBarChange,
  actionsRef,
}: DeckStreamPanelProps) {
  // Nothing to load without a linked channel, so it never starts in a spinner.
  const [loading, setLoading] = useState(broadcasterId != null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // What Twitch last told us, so "dirty" means changed against the real
  // channel rather than against whatever was on screen at mount.
  const [saved, setSaved] = useState<{ title: string; category: Category | null } | null>(null);

  const applyInfo = useCallback((result: ChannelInfoResult) => {
    if (!result.ok || !result.info) {
      setLoadError(result.error ?? "Couldn't load your channel info");
      setLoading(false);
      return;
    }

    const loaded: Category | null = result.info.game_id
      ? { id: result.info.game_id, name: result.info.game_name, boxArtUrl: result.boxArtUrl }
      : null;
    setTitle(result.info.title);
    setCategory(loaded);
    setSaved({ title: result.info.title, category: loaded });
    setLoadError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!broadcasterId) return;
    // Guarded so a slow Helix response can't write into an unmounted panel
    // after the streamer has already switched tabs.
    let cancelled = false;
    void getMyChannelInfo().then((result) => {
      if (!cancelled) applyInfo(result);
    });
    return () => {
      cancelled = true;
    };
  }, [broadcasterId, applyInfo]);

  /** Manual refetch from a tap, which may show the spinner again. */
  const reload = useCallback(() => {
    setLoading(true);
    void getMyChannelInfo().then(applyInfo);
  }, [applyInfo]);

  const dirty =
    saved != null && (title !== saved.title || (category?.id ?? null) !== (saved.category?.id ?? null));
  const hasErrors = title.trim().length === 0;

  const save = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await updateChannelInfo({
        title: title.trim(),
        gameId: category?.id,
      });
      if (!result.ok) {
        toast.error("Couldn't update your channel", { description: result.error });
        return;
      }
      setSaved({ title: title.trim(), category });
      setTitle(title.trim());
      toast.success("Channel updated");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, title, category]);

  const discard = useCallback(() => {
    if (!saved) return;
    setTitle(saved.title);
    setCategory(saved.category);
  }, [saved]);

  // The save bar lives in the deck footer, so the panel reports its state up
  // and hands over the two actions the bar can trigger.
  const saveRef = useRef(save);
  const discardRef = useRef(discard);
  useEffect(() => {
    saveRef.current = save;
    discardRef.current = discard;
  }, [save, discard]);

  useEffect(() => {
    actionsRef.current = {
      save: () => void saveRef.current(),
      discard: () => discardRef.current(),
    };
    return () => {
      actionsRef.current = null;
    };
  }, [actionsRef]);

  useEffect(() => {
    onSaveBarChange({ dirty, submitting, hasErrors });
  }, [dirty, submitting, hasErrors, onSaveBarChange]);

  if (!broadcasterId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm">Connect your Twitch account to edit your title and category.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <p className="text-sm">{loadError}</p>
          <Button variant="outline" className="h-12 w-full rounded-xl" onClick={reload}>
            <RotateCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <TitleField value={title} onChange={setTitle} disabled={!canInteract || submitting} />

      <CategoryPicker
        broadcasterId={broadcasterId}
        value={category}
        onChange={setCategory}
        disabled={!canInteract || submitting}
      />

      {/* Twitch is the source of truth and a mod or the phone app can change it
          underneath this form; refetching is how the streamer resyncs without
          reloading the whole deck. */}
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-full rounded-xl text-muted-foreground"
        onClick={reload}
        disabled={submitting}
      >
        <RotateCw className="mr-2 h-4 w-4" />
        Reload from Twitch
      </Button>
    </div>
  );
}
