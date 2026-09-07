"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { Check, Loader2, Pencil, X, Gamepad2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Button, Input } from "@repo/ui";
import { updateChannelInfo } from "@/actions/twitch/channels";
import { LookupTwitchGame } from "@/actions/twitch/twitch-api";
import TwitchCategorySearch from "@/components/search-bars/twitch-category-search";

interface StreamInfoPanelProps {
  broadcasterId: string;
  currentTitle: string | null;
  currentCategory: string | null;
  currentGameId: string | null;
}

export function StreamInfoPanel({
  broadcasterId,
  currentTitle,
  currentCategory,
  currentGameId,
}: StreamInfoPanelProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(currentTitle ?? "");
  const [gameId, setGameId] = useState(currentGameId ?? "");
  const [gameName, setGameName] = useState(currentCategory ?? "");
  const [gameBoxArt, setGameBoxArt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!gameId) {
      setGameBoxArt(null);
      return;
    }
    LookupTwitchGame(gameId).then((game) => {
      if (game) {
        setGameBoxArt(game.box_art_url.replace("{width}", "52").replace("{height}", "72"));
        setGameName(game.name);
      }
    });
  }, [gameId]);

  function handleCancel() {
    setTitle(currentTitle ?? "");
    setGameId(currentGameId ?? "");
    setGameName(currentCategory ?? "");
    setEditing(false);
  }

  function handleSave() {
    startTransition(async () => {
      try {
        // The broadcaster is derived from the session server-side; passing an
        // id from here would only be a suggestion the action ignores.
        const result = await updateChannelInfo({
          title: title || undefined,
          gameId: gameId || undefined,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't update channel. Try again.");
          return;
        }
        toast.success("Channel updated.");
        setEditing(false);
        router.refresh();
      } catch {
        toast.error("Couldn't update channel. Try again.");
      }
    });
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-colors hover:border-white/[0.12]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Stream info</span>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-white/[0.15] hover:text-foreground cursor-pointer"
              aria-label="Edit stream info"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you streaming?"
                className="h-9 border-white/[0.08] bg-white/[0.03] text-sm focus-visible:border-purple-500/50 focus-visible:ring-purple-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Category</label>
              <div className="flex items-start gap-2">
                <div className="shrink-0">
                  {gameBoxArt ? (
                    <div className="overflow-hidden rounded-lg border border-white/[0.08]">
                      <Image src={gameBoxArt} alt={gameName} width={40} height={56} className="object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-14 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02]">
                      <Gamepad2 className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <TwitchCategorySearch
                    placeholder="Search categories…"
                    initalValue={currentGameId}
                    value={gameId}
                    setValue={setGameId}
                    broadcasterId={broadcasterId}
                  />
                  {gameName && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">{gameName}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">{isPending ? "Saving…" : "Save"}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/[0.08] hover:border-white/[0.15]"
                onClick={handleCancel}
                disabled={isPending}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {currentCategory && (
              <div className="flex items-start gap-3">
                {gameBoxArt ? (
                  <div className="shrink-0 overflow-hidden rounded-lg border border-white/[0.08]">
                    <Image src={gameBoxArt} alt={currentCategory} width={40} height={56} className="object-cover" />
                  </div>
                ) : (
                  <CategoryBoxArt gameId={currentGameId} setBoxArt={setGameBoxArt} />
                )}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="mt-0.5 text-sm font-medium truncate">{currentCategory}</p>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground">Title</p>
              <p className="mt-0.5 text-sm font-medium leading-snug line-clamp-3">
                {currentTitle ?? <span className="text-muted-foreground/60 italic">No title set</span>}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryBoxArt({
  gameId,
  setBoxArt,
}: {
  gameId: string | null;
  setBoxArt: (url: string) => void;
}) {
  useEffect(() => {
    if (!gameId) return;
    LookupTwitchGame(gameId).then((game) => {
      if (game) {
        setBoxArt(game.box_art_url.replace("{width}", "52").replace("{height}", "72"));
      }
    });
  }, [gameId, setBoxArt]);

  return (
    <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02]">
      <Gamepad2 className="h-4 w-4 text-muted-foreground/50" />
    </div>
  );
}
