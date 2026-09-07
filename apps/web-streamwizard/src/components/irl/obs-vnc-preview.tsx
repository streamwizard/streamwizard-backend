"use client";

import { Loader2, Monitor } from "lucide-react";
import { Badge } from "@repo/ui";
import { cn } from "@repo/ui";

export type VncPreviewStatus = "offline" | "booting" | "connected";

interface ObsVncPreviewProps {
  instanceId: string | null;
  status: VncPreviewStatus;
  onOpen: () => void;
}

export function ObsVncPreview({ instanceId, status, onOpen }: ObsVncPreviewProps) {
  // Only the live connection can be opened — a viewer launched mid-boot just
  // shows a window that can't connect, so the tile stays non-interactive until
  // OBS is actually reachable.
  const canOpen = status === "connected" && !!instanceId;

  return (
    <button
      onClick={canOpen ? onOpen : undefined}
      disabled={!canOpen}
      aria-label={
        status === "connected"
          ? "Open Cloud OBS viewer"
          : status === "booting"
          ? "Cloud OBS is booting"
          : "No running Cloud OBS instance"
      }
      className={cn(
        "group relative w-full max-w-xs rounded-xl border-2 bg-black overflow-hidden transition-all",
        canOpen
          ? "border-border cursor-pointer hover:border-primary hover:shadow-lg hover:shadow-primary/10"
          : "border-border/40 cursor-not-allowed"
      )}
      style={{ aspectRatio: "16 / 9" }}
    >
      {/* Screen scanline texture */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px)",
        }}
      />

      {/* Boot shimmer — a moving sheen that signals work-in-progress */}
      {status === "booting" && (
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent pointer-events-none" />
      )}

      {/* Status badge */}
      <div className="absolute top-2 right-2 z-10">
        {status === "connected" ? (
          <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 border-0">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </Badge>
        ) : status === "booting" ? (
          <Badge className="bg-amber-500/90 text-black text-[10px] px-1.5 py-0 border-0">
            <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />
            BOOTING
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-black/60 text-muted-foreground text-[10px] px-1.5 py-0">
            OFFLINE
          </Badge>
        )}
      </div>

      {/* Center icon */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        {status === "booting" ? (
          <Loader2 className="h-10 w-10 animate-spin text-amber-400/80" />
        ) : (
          <Monitor
            className={cn(
              "h-10 w-10 transition-transform",
              canOpen
                ? "text-muted-foreground group-hover:text-primary group-hover:scale-110"
                : "text-muted-foreground/40"
            )}
          />
        )}
        <span
          className={cn(
            "text-xs transition-colors",
            canOpen
              ? "text-muted-foreground group-hover:text-primary"
              : "text-muted-foreground/60"
          )}
        >
          {status === "connected"
            ? "Click to open OBS"
            : status === "booting"
            ? "Booting OBS…"
            : "No running instance"}
        </span>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
        <p className="text-[10px] text-muted-foreground/60 truncate">Cloud OBS</p>
      </div>
    </button>
  );
}
