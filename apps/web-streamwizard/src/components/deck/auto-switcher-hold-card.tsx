"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AutoSwitcherStatus } from "@repo/schemas";
import { Button, Card, CardContent } from "@repo/ui";
import { Hand, Loader2, Repeat } from "lucide-react";
import { useAutoSwitcherStatus } from "@/hooks/obs/use-auto-switcher-status";
import { clearSceneOverride } from "@/actions/supabase/auto-switcher";

// A deck tap just wrote the override, so the engine's last status frame may
// predate it. Frames arrive every ~5s; only trust the live status again after
// this many fresh frames since the tap.
const FRAMES_UNTIL_STATUS_TRUSTED = 2;

interface AutoSwitcherHoldCardProps {
  enabled: boolean;
  canInteract: boolean;
  /** Last override state known locally: seeded from the config row, updated on deck taps/release. */
  heldScene: string | null;
  /** Changes on every deck hold/release action (0 = none this session). */
  heldAt: number;
  onReleased: () => void;
}

/**
 * Compact deck variant of the dashboard's "Hold a scene" controls. The deck
 * has no scene/duration pickers: tapping a scene IS the hold, so this card
 * only shows the switcher state and offers the release action.
 */
export function AutoSwitcherHoldCard({ enabled, canInteract, heldScene, heldAt, onReleased }: AutoSwitcherHoldCardProps) {
  const { status, connected } = useAutoSwitcherStatus();
  const [busy, setBusy] = useState(false);
  // Count status frames seen since the last deck action (adjust-state-during-
  // render pattern; frames are distinguished by object identity).
  const [sync, setSync] = useState<{ actionAt: number; frames: number; lastFrame: AutoSwitcherStatus | null }>({
    actionAt: heldAt,
    frames: 0,
    lastFrame: null,
  });
  if (sync.actionAt !== heldAt) {
    setSync({ actionAt: heldAt, frames: 0, lastFrame: status });
  } else if (status && status !== sync.lastFrame) {
    setSync({ actionAt: sync.actionAt, frames: sync.frames + 1, lastFrame: status });
  }

  if (!enabled) return null;

  // Live engine status is the truth, except right after a deck action (frames
  // may predate the write) or when the status feed is down entirely.
  const statusTrusted = status != null && (heldAt === 0 || sync.frames >= FRAMES_UNTIL_STATUS_TRUSTED);
  const override = statusTrusted ? status.override : heldScene ? { scene_name: heldScene } : null;
  const held = override != null;

  async function release() {
    setBusy(true);
    const result = await clearSceneOverride();
    setBusy(false);
    if (result.ok) {
      toast.success("Released. Auto switching is back on.");
      onReleased();
    } else {
      toast.error(result.error ?? "Could not clear the override");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-3">
          {held ? (
            <Hand className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <Repeat className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            {held ? (
              <>
                <p className="truncate text-sm font-medium">Holding {override.scene_name ?? "this scene"}</p>
                <p className="text-xs text-muted-foreground">Auto switching is paused.</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Auto switching is on. Tap a scene to hold it.</p>
            )}
          </div>
        </div>
        {held && (
          <Button variant="outline" className="h-12 w-full rounded-xl" onClick={release} disabled={!canInteract || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Repeat className="h-4 w-4 mr-2" />}
            Resume auto switching
          </Button>
        )}
        {!status && !connected && (
          <p className="text-xs text-muted-foreground">Live status unavailable. Showing the last known state.</p>
        )}
      </CardContent>
    </Card>
  );
}
