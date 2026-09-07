"use client";

import { Button } from "@repo/ui";
import { Checkbox } from "@repo/ui";
import { Input } from "@repo/ui";
import { Label } from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { Separator } from "@repo/ui";
import { Slider } from "@repo/ui";
import { Switch } from "@repo/ui";
import { Database } from "@repo/supabase";
import { X } from "lucide-react";
import { InspectorSection } from "../../editor/inspector-section";
import {
  DEFAULT_CLIPS_WIDGET_ITEM_CONFIG,
  type ClipSourceMode,
  type ClipSortOption,
  type ClipTransitionMode,
  type ClipsWidgetItemConfig,
  type TimeWindowPreset,
} from "@/types/overlays";

interface ClipsWidgetConfigPanelProps {
  config: ClipsWidgetItemConfig;
  onUpdate: (updates: Partial<ClipsWidgetItemConfig>) => void;
  clipFolders: Database["public"]["Tables"]["clip_folders"]["Row"][];
}

export function ClipsWidgetConfigPanel({
  config,
  onUpdate,
  clipFolders,
}: ClipsWidgetConfigPanelProps) {
  return (
    <div className="space-y-5">
      <InspectorSection title="Clip Source" defaultOpen>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Source Mode</Label>
            <Select
              value={config.sourceMode}
              onValueChange={(val) =>
                onUpdate({ sourceMode: val as ClipSourceMode })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clips</SelectItem>
                <SelectItem value="folders">Specific Folders</SelectItem>
                <SelectItem value="game">By Game / Category</SelectItem>
                <SelectItem value="custom">Custom Filters</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Folder selection */}
          {(config.sourceMode === "folders" ||
            config.sourceMode === "custom") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Folders</Label>
              <div className="space-y-1.5">
                {clipFolders.map((folder) => {
                  const isChecked = config.folderIds.includes(folder.id);
                  return (
                    <label
                      key={folder.id}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded px-2 py-1"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          const newFolderIds = checked
                            ? [...config.folderIds, folder.id]
                            : config.folderIds.filter(
                                (id) => id !== folder.id
                              );
                          onUpdate({ folderIds: newFolderIds });
                        }}
                      />
                      <span className="truncate">{folder.name}</span>
                    </label>
                  );
                })}
                {clipFolders.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No folders created yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Game ID input */}
          {(config.sourceMode === "game" ||
            config.sourceMode === "custom") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Game IDs</Label>
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1">
                  {config.gameIds.map((gameId) => (
                    <span
                      key={gameId}
                      className="inline-flex items-center gap-1 bg-accent px-2 py-0.5 rounded text-xs"
                    >
                      {gameId}
                      <button
                        type="button"
                        onClick={() =>
                          onUpdate({
                            gameIds: config.gameIds.filter(
                              (id) => id !== gameId
                            ),
                          })
                        }
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <Input
                  placeholder="Add game ID and press Enter"
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !config.gameIds.includes(val)) {
                        onUpdate({ gameIds: [...config.gameIds, val] });
                        (e.target as HTMLInputElement).value = "";
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Creator IDs */}
          {config.sourceMode === "custom" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Creator IDs (optional)</Label>
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1">
                  {config.creatorIds.map((creatorId) => (
                    <span
                      key={creatorId}
                      className="inline-flex items-center gap-1 bg-accent px-2 py-0.5 rounded text-xs"
                    >
                      {creatorId}
                      <button
                        type="button"
                        onClick={() =>
                          onUpdate({
                            creatorIds: config.creatorIds.filter(
                              (id) => id !== creatorId
                            ),
                          })
                        }
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <Input
                  placeholder="Add creator ID and press Enter"
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !config.creatorIds.includes(val)) {
                        onUpdate({
                          creatorIds: [...config.creatorIds, val],
                        });
                        (e.target as HTMLInputElement).value = "";
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </InspectorSection>

      <Separator />

      <InspectorSection title="Playback">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <Label className="text-xs">Muted</Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Off to hear clip audio in OBS (browsers often require mute for
                autoplay until the user interacts).
              </p>
            </div>
            <Switch
              checked={config.clipMuted}
              onCheckedChange={(checked) => onUpdate({ clipMuted: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">
              Volume ({Math.round(config.clipVolume * 100)}%)
            </Label>
            <Slider
              value={[config.clipVolume]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([v]) =>
                onUpdate({ clipVolume: Math.max(0, Math.min(1, v ?? 0)) })
              }
              className="py-1"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Clip transition</Label>
            <Select
              value={config.clipTransition}
              onValueChange={(val) =>
                onUpdate({ clipTransition: val as ClipTransitionMode })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cut">Hard cut</SelectItem>
                <SelectItem value="crossfade">Crossfade</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Hard cut switches instantly; crossfade overlaps clips for a short
              blend.
            </p>
          </div>

          {config.clipTransition === "crossfade" ? (
            <div className="space-y-2">
              <Label className="text-xs">
                Crossfade ({config.clipTransitionMs} ms)
              </Label>
              <Slider
                value={[config.clipTransitionMs]}
                min={200}
                max={3000}
                step={50}
                onValueChange={([v]) =>
                  onUpdate({
                    clipTransitionMs: Math.round(
                      Math.max(200, Math.min(3000, v ?? 600))
                    ),
                  })
                }
                className="py-1"
              />
            </div>
          ) : null}
        </div>
      </InspectorSection>

      <Separator />

      {/* Time window */}
      <InspectorSection title="Time Window">

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Period</Label>
            <Select
              value={config.timeWindow}
              onValueChange={(val) =>
                onUpdate({
                  timeWindow: val as TimeWindowPreset | "custom",
                })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last7d">Last 7 Days</SelectItem>
                <SelectItem value="last30d">Last 30 Days</SelectItem>
                <SelectItem value="last90d">Last 90 Days</SelectItem>
                <SelectItem value="last365d">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.timeWindow === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Start</Label>
                <Input
                  type="date"
                  value={config.customDateRange?.start ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      customDateRange: {
                        start: e.target.value,
                        end: config.customDateRange?.end ?? "",
                      },
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End</Label>
                <Input
                  type="date"
                  value={config.customDateRange?.end ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      customDateRange: {
                        start: config.customDateRange?.start ?? "",
                        end: e.target.value,
                      },
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </InspectorSection>

      <Separator />

      {/* Sort & Limits */}
      <InspectorSection title="Sort & Limits">

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Sort By</Label>
            <Select
              value={config.sort}
              onValueChange={(val) =>
                onUpdate({ sort: val as ClipSortOption })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="most_viewed">Most Viewed</SelectItem>
                <SelectItem value="least_viewed">Least Viewed</SelectItem>
                <SelectItem value="random">Random</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Min View Count</Label>
            <Input
              type="number"
              value={config.minViewCount}
              onChange={(e) =>
                onUpdate({
                  minViewCount: Math.max(0, Number(e.target.value)),
                })
              }
              className="h-8 text-sm"
              min={0}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Featured Only</Label>
            <Switch
              checked={config.isFeaturedOnly}
              onCheckedChange={(checked) =>
                onUpdate({ isFeaturedOnly: checked })
              }
            />
          </div>
        </div>
      </InspectorSection>

      {/* Reset */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => onUpdate({ ...DEFAULT_CLIPS_WIDGET_ITEM_CONFIG })}
      >
        Reset to Defaults
      </Button>
    </div>
  );
}
