"use client";

import { captureEvent } from "@repo/posthog";
import { Button } from "@repo/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui";
import { Input } from "@repo/ui";
import { Label } from "@repo/ui";
import { Switch } from "@repo/ui";
import { Badge } from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import {
  Copy,
  Download,
  Edit,
  Layers,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Upload,
  Monitor,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { env } from "@/lib/env";
import {
  createOverlayScene,
  deleteOverlayScene,
  duplicateOverlayScene,
  resetSceneSubscriberToken,
  updateOverlayScene,
} from "@/actions/overlays/scenes";
import { createOverlayFromTemplate } from "@/actions/overlays/templates";
import { exportOverlayScene, importOverlayScene } from "@/actions/overlays/transfer";
import {
  DEFAULT_OVERLAY_SORT,
  OVERLAY_SORT_OPTIONS,
  filterScenes,
  isOverlaySortKey,
  readOverlaySort,
  saveOverlaySort,
  sortScenes,
  subscribeOverlaySort,
} from "./overlay-list";

export interface OverlayTemplateOption {
  slug: string;
  name: string;
  description: string;
  render_mode: string;
}

interface OverlayScene {
  id: string;
  name: string;
  slug: string;
  width: number;
  height: number;
  is_active: boolean;
  is_favourite: boolean;
  render_mode?: string;
  created_at: string;
  updated_at: string;
}

type RenderMode = "obs" | "gps";

export function OverlayScenesList({
  scenes,
  templates,
}: {
  scenes: OverlayScene[];
  templates: OverlayTemplateOption[];
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renderMode, setRenderMode] = useState<RenderMode>("obs");
  const [templateId, setTemplateId] = useState("blank");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdScene, setCreatedScene] = useState<OverlayScene | null>(null);
  const [resetKeyScene, setResetKeyScene] = useState<OverlayScene | null>(null);
  const [isResettingKey, setIsResettingKey] = useState(false);
  const [deleteScene, setDeleteScene] = useState<OverlayScene | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  // The saved sort lives in localStorage; the server snapshot is the default so
  // hydration matches, and the real choice lands right after.
  const sort = useSyncExternalStore(subscribeOverlaySort, readOverlaySort, () => DEFAULT_OVERLAY_SORT);
  // A star flips the moment it is clicked. The server's answer arrives with the
  // next refresh; until then the override is what the card shows.
  const [favouriteOverrides, setFavouriteOverrides] = useState<Record<string, boolean>>({});

  const visibleScenes = useMemo(() => {
    const withOverrides = scenes.map((scene) =>
      scene.id in favouriteOverrides
        ? { ...scene, is_favourite: favouriteOverrides[scene.id] ?? scene.is_favourite }
        : scene
    );
    return sortScenes(filterScenes(withOverrides, search), sort);
  }, [scenes, favouriteOverrides, search, sort]);

  function changeSort(value: string) {
    if (isOverlaySortKey(value)) saveOverlaySort(value);
  }

  // A template is built for one render mode; "blank" suits both.
  const availableTemplates = templates.filter(
    (t) => t.slug === "blank" || t.render_mode === renderMode
  );

  function selectRenderMode(mode: RenderMode) {
    setRenderMode(mode);
    // The picked template may not exist in the other mode; fall back to blank.
    setTemplateId((current) =>
      templates.some((t) => t.slug === current && t.render_mode === mode) ? current : "blank"
    );
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setIsCreating(true);

    const effectiveTemplate = templateId;
    const { data, error } =
      effectiveTemplate === "blank"
        ? await createOverlayScene({ name: newName.trim(), render_mode: renderMode })
        : await createOverlayFromTemplate({
            name: newName.trim(),
            templateId: effectiveTemplate,
            render_mode: renderMode,
          });

    if (error) {
      toast.error(error);
    } else if (data) {
      captureEvent("overlay_created", { template: effectiveTemplate, render_mode: renderMode });
      toast.success("Overlay created");
      setNewName("");
      setTemplateId("blank");
      // Stay in the dialog: show the done step with the browser-source URL
      // and OBS instructions instead of dropping straight into the editor.
      setCreatedScene(data as OverlayScene);
      router.refresh();
    }

    setIsCreating(false);
  }

  function closeCreateDialog(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setCreatedScene(null);
      setRenderMode("obs");
      setTemplateId("blank");
    }
  }

  async function handleDelete() {
    if (!deleteScene) return;
    setIsDeleting(true);

    const { success, error } = await deleteOverlayScene(deleteScene.id);

    setIsDeleting(false);

    if (success) {
      setDeleteScene(null);
      toast.success("Overlay deleted");
      router.refresh();
    } else {
      toast.error(error ?? "Failed to delete");
    }
  }

  async function handleExport(scene: OverlayScene) {
    const { data, error } = await exportOverlayScene(scene.id);
    if (!data) {
      toast.error(error ?? "Couldn't export that overlay");
      return;
    }

    // Handing the file over is a browser job: the action only builds the document.
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${scene.slug || "overlay"}.streamwizard.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Overlay exported");
  }

  async function handleImportFile(file: File) {
    setIsImporting(true);
    const { data, error, notes } = await importOverlayScene(await file.text());
    setIsImporting(false);

    if (!data) {
      toast.error(error ?? "Couldn't import that file");
      return;
    }

    toast.success(`${data.name} imported`, {
      description: notes.length > 0 ? notes.join(" ") : undefined,
    });
    router.refresh();
  }

  async function handleDuplicate(id: string) {
    const { data, error } = await duplicateOverlayScene(id);
    if (data) {
      toast.success("Overlay duplicated");
      router.refresh();
    } else {
      toast.error(error ?? "Failed to duplicate");
    }
  }

  /**
   * Rotates the scene's subscriber token — the key an open overlay page uses to
   * read and write its own widget state. The browser-source URL keeps working;
   * anything still holding the old key stops.
   */
  async function handleResetKey() {
    if (!resetKeyScene) return;
    setIsResettingKey(true);

    const { error } = await resetSceneSubscriberToken(resetKeyScene.id);

    setIsResettingKey(false);
    setResetKeyScene(null);

    if (error) {
      toast.error(error);
    } else {
      toast.success("Overlay key reset. Refresh the browser source in OBS.");
      router.refresh();
    }
  }

  async function handleToggleFavourite(scene: OverlayScene) {
    const next = !scene.is_favourite;
    setFavouriteOverrides((current) => ({ ...current, [scene.id]: next }));

    const { error } = await updateOverlayScene({ id: scene.id, is_favourite: next });
    if (error) {
      setFavouriteOverrides((current) => {
        const rest = { ...current };
        delete rest[scene.id];
        return rest;
      });
      toast.error(error);
      return;
    }

    captureEvent("overlay_favourite_toggled", { favourite: next });
    router.refresh();
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    const { error } = await updateOverlayScene({ id, is_active: isActive });
    if (error) {
      toast.error(error);
    } else {
      toast.success(isActive ? "Overlay activated" : "Overlay deactivated");
      router.refresh();
    }
  }

  function getOverlayUrl(scene: OverlayScene) {
    return `${env.NEXT_PUBLIC_OVERLAY_URL}/${scene.slug}`;
  }

  return (
    <div className="space-y-4">
      <div
        className={
          scenes.length > 0
            ? "flex items-center gap-2"
            : "hidden md:flex items-center gap-2"
        }
      >
        {scenes.length > 0 && (
          <>
            <div className="relative flex-1 md:w-64 md:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search overlays"
                aria-label="Search overlays by name"
                className="pl-8"
              />
            </div>
            <Select value={sort} onValueChange={changeSort}>
              <SelectTrigger className="w-36 shrink-0" aria-label="Sort overlays">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OVERLAY_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        {/* Pushes the desktop-only actions to the right edge. */}
        <div className="hidden flex-1 md:block" />
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset first, so picking the same file twice still fires.
            e.target.value = "";
            if (file) handleImportFile(file);
          }}
        />
        <Button
          variant="outline"
          className="hidden md:inline-flex"
          onClick={() => importInputRef.current?.click()}
          disabled={isImporting}
        >
          <Upload className="mr-2 h-4 w-4" />
          {isImporting ? "Importing..." : "Import"}
        </Button>
        <Dialog open={dialogOpen} onOpenChange={closeCreateDialog}>
          <DialogTrigger asChild>
            <Button className="hidden md:inline-flex">
              <Plus className="mr-2 h-4 w-4" />
              New Overlay
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{createdScene ? "Your overlay is ready" : "Create New Overlay"}</DialogTitle>
            </DialogHeader>
            {createdScene ? (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Browser source URL</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={getOverlayUrl(createdScene)} className="text-sm" />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      title="Copy URL"
                      onClick={() => {
                        navigator.clipboard.writeText(getOverlayUrl(createdScene));
                        toast.success("Overlay URL copied");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {createdScene.render_mode !== "gps" ? (
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                    <li>In OBS, add a source: Sources → + → Browser.</li>
                    <li>Paste the URL above.</li>
                    <li>
                      Set width to {createdScene.width} and height to {createdScene.height}.
                    </li>
                    <li>Turn the overlay on with the switch on its card when you go live.</li>
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Open this URL in your phone&apos;s browser while streaming. It reads your GPS on the
                    device, so keep the tab in the foreground.
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      closeCreateDialog(false);
                      router.push(`/dashboard/overlays/${createdScene.id}/edit`);
                    }}
                  >
                    Open editor
                  </Button>
                  <Button variant="outline" onClick={() => closeCreateDialog(false)}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="overlay-name">Name</Label>
                <Input
                  id="overlay-name"
                  placeholder="My Overlay"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>

              {/* OBS / GPS toggle */}
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => selectRenderMode("obs")}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
                      renderMode === "obs"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <Monitor className="h-5 w-5" />
                    <span className="font-medium">OBS</span>
                    <span className="text-xs text-center leading-tight opacity-70">
                      Browser source in OBS
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectRenderMode("gps")}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
                      renderMode === "gps"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <Smartphone className="h-5 w-5" />
                    <span className="font-medium">GPS</span>
                    <span className="text-xs text-center leading-tight opacity-70">
                      Rendered on your phone with GPS
                    </span>
                  </button>
                </div>
              </div>

              {/* Starter templates for the selected render mode. */}
              {availableTemplates.length > 0 && (
                <div className="space-y-2">
                  <Label>Start from</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableTemplates.map((template) => (
                      <button
                        key={template.slug}
                        type="button"
                        onClick={() => setTemplateId(template.slug)}
                        className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-colors ${
                          templateId === template.slug
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <span className="font-medium">{template.name}</span>
                        <span className="text-xs text-muted-foreground leading-tight">
                          {template.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleCreate}
                disabled={isCreating || !newName.trim()}
                className="w-full"
              >
                {isCreating ? "Creating..." : "Create Overlay"}
              </Button>
            </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {scenes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Layers className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No overlays yet</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Create your first overlay to get started.
            </p>
          </CardContent>
        </Card>
      ) : visibleScenes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">
              No overlay called &ldquo;{search.trim()}&rdquo;
            </h3>
            <p className="text-muted-foreground text-sm mt-1">
              Check the spelling, or clear the search to see all {scenes.length}.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setSearch("")}
            >
              Clear search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleScenes.map((scene) => (
            <Card key={scene.id} className="group relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base truncate">
                        {scene.name}
                      </CardTitle>
                      {scene.render_mode === "gps" ? (
                        <Badge variant="outline" className="shrink-0 gap-1 text-[10px] px-1.5">
                          <Smartphone className="h-2.5 w-2.5" />
                          GPS
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 gap-1 text-[10px] px-1.5">
                          <Monitor className="h-2.5 w-2.5" />
                          OBS
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      {scene.width}x{scene.height} · Updated{" "}
                      {new Date(scene.updated_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-pressed={scene.is_favourite}
                    aria-label={
                      scene.is_favourite ? "Remove from favourites" : "Add to favourites"
                    }
                    title={scene.is_favourite ? "Remove from favourites" : "Add to favourites"}
                    onClick={() => handleToggleFavourite(scene)}
                  >
                    <Star
                      className={`h-4 w-4 ${
                        scene.is_favourite
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild className="hidden md:flex">
                        <Link href={`/dashboard/overlays/${scene.id}/edit`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDuplicate(scene.id)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(scene)}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setResetKeyScene(scene)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset overlay key
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteScene(scene)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={scene.is_active}
                      onCheckedChange={(checked) =>
                        handleToggleActive(scene.id, checked)
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {scene.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(getOverlayUrl(scene));
                        toast.success("URL copied");
                      }}
                    >
                      <Copy className="mr-2 h-3 w-3" />
                      Copy URL
                    </Button>
                    <Button variant="outline" size="sm" asChild className="hidden md:inline-flex">
                      <Link href={`/dashboard/overlays/${scene.id}/edit`}>
                        <Edit className="mr-2 h-3 w-3" />
                        Edit
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={resetKeyScene !== null} onOpenChange={(open) => !open && setResetKeyScene(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the key for {resetKeyScene?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Do this if someone else got hold of your overlay. The URL stays the same, but every
              browser source that has this overlay open right now goes blank until you refresh it in
              OBS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResettingKey}>Never mind</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetKey} disabled={isResettingKey}>
              {isResettingKey ? "Resetting..." : "Reset key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteScene !== null}
        onOpenChange={(open) => !open && setDeleteScene(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteScene?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This takes the overlay and everything on it. Its browser source
              stops working, so anywhere you have this URL in OBS goes blank.
              There is no undo for this one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Never mind</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                // Deleting is async; let the dialog stay up under the pending
                // label instead of closing on the click.
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete overlay"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
