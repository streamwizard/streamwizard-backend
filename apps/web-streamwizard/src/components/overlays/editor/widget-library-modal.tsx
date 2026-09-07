"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui";
import {
  createWidget,
  deleteWidget,
  getWidgets,
  getApprovedLibraryEntries,
  getWidgetTemplates,
  installWidgetTemplate,
  installWidgetFromLibrary,
} from "@/actions/widgets";
import type { WidgetTemplate, Widget } from "@/actions/widgets";
import { Plus, Pencil, Trash2, Code2, Sparkles } from "lucide-react";
import { primeWidgetCache } from "@/components/overlays/widgets/custom/widget-cache";
import { LibraryCard, type LibraryEntry } from "./library-card";
import { DEFAULT_WIDGET_HTML, DEFAULT_WIDGET_JS } from "./new-widget-template";

interface WidgetLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCanvas: (widgetId: string) => void;
}

export function WidgetLibraryModal({ open, onOpenChange, onAddToCanvas }: WidgetLibraryModalProps) {
  const router = useRouter();
  const [myWidgets, setMyWidgets] = useState<Widget[]>([]);
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [widgetTemplates, setWidgetTemplates] = useState<WidgetTemplate[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [search, setSearch] = useState("");
  const [newWidgetName, setNewWidgetName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingMine(true);
    getWidgets().then(({ data }) => {
      setMyWidgets(data ?? []);
      // Adding one to the canvas should render it without a second fetch.
      primeWidgetCache(data ?? []);
      setLoadingMine(false);
    });
    getWidgetTemplates().then(({ data }) => setWidgetTemplates(data ?? []));
    setLoadingLibrary(true);
    getApprovedLibraryEntries().then(({ data }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLibraryEntries((data ?? []) as any);
      setLoadingLibrary(false);
    });
  }, [open]);

  function handleCreate() {
    if (!newWidgetName.trim()) return;
    startTransition(async () => {
      const { data } = await createWidget({ name: newWidgetName.trim(), html: DEFAULT_WIDGET_HTML, js: DEFAULT_WIDGET_JS });
      if (data) {
        setCreateOpen(false);
        setNewWidgetName("");
        onOpenChange(false);
        router.push(`/dashboard/widgets/${data.id}`);
      }
    });
  }

  function confirmDelete(id: string) {
    setDeleteTargetId(id);
  }

  function handleDelete() {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    startTransition(async () => {
      await deleteWidget(id);
      setMyWidgets((prev) => prev.filter((w) => w.id !== id));
    });
  }

  function handleEdit(id: string) {
    onOpenChange(false);
    router.push(`/dashboard/widgets/${id}`);
  }

  function handleUseWidgetTemplate(templateId: string, addToCanvas: boolean) {
    setInstallingId(templateId);
    startTransition(async () => {
      const { data } = await installWidgetTemplate(templateId);
      setInstallingId(null);
      if (!data) return;
      setMyWidgets((prev) => [data, ...prev]);
      primeWidgetCache([data]);
      if (addToCanvas) {
        onAddToCanvas(data.id);
        onOpenChange(false);
      }
    });
  }

  function handleInstall(entryId: string) {
    setInstallingId(entryId);
    startTransition(async () => {
      const { data } = await installWidgetFromLibrary(entryId);
      setInstallingId(null);
      if (data) {
        setMyWidgets((prev) => [data, ...prev]);
        primeWidgetCache([data]);
      }
    });
  }

  const filteredLibrary = libraryEntries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen max-w-screen h-[85vh] flex flex-col rounded-none sm:rounded-lg sm:w-[98vw] sm:max-w-[98vw]">
        <DialogHeader>
          <DialogTitle>Widget Library</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="personal" className="flex flex-col flex-1 min-h-0">
          <TabsList className="shrink-0">
            <TabsTrigger value="personal">My Widgets</TabsTrigger>
            <TabsTrigger value="starters">Starters</TabsTrigger>
            <TabsTrigger value="public">Public Library</TabsTrigger>
          </TabsList>

          <TabsContent value="starters" className="flex-1 overflow-y-auto mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Ready-made widgets. Use one as-is or open the code and make it yours.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {widgetTemplates.map((widgetTemplate) => (
                <div key={widgetTemplate.id} className="rounded-lg border bg-card p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <h4 className="text-sm font-semibold">{widgetTemplate.name}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground flex-1">{widgetTemplate.description}</p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={installingId === widgetTemplate.id}
                      onClick={() => handleUseWidgetTemplate(widgetTemplate.id, true)}
                    >
                      Add to canvas
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={installingId === widgetTemplate.id}
                      onClick={() => handleUseWidgetTemplate(widgetTemplate.id, false)}
                      title="Copies it to My Widgets without placing it"
                    >
                      Save only
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="personal" className="flex-1 overflow-y-auto mt-4 space-y-4">
            <div className="flex justify-end">
              {createOpen ? (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Widget name"
                    value={newWidgetName}
                    onChange={(e) => setNewWidgetName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    autoFocus
                    className="h-8 w-48"
                  />
                  <Button size="sm" onClick={handleCreate} disabled={isPending || !newWidgetName.trim()}>
                    Create
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setCreateOpen(false); setNewWidgetName(""); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Widget
                </Button>
              )}
            </div>

            {loadingMine && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
            {!loadingMine && myWidgets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No widgets yet. Create your first one to get started.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {myWidgets.map((w) => (
                <div
                  key={w.id}
                  className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-md transition-all duration-200"
                >
                  {/* Banner */}
                  <div className="relative h-28 bg-linear-to-br from-indigo-500/20 via-purple-500/10 to-pink-500/10 flex items-center justify-center shrink-0">
                    <div className="rounded-xl bg-background/60 backdrop-blur-sm p-3 ring-1 ring-white/10">
                      <Code2 className="h-7 w-7 text-indigo-400" />
                    </div>
                    {/* Delete — appears on hover */}
                    <button
                      className="absolute top-2 right-2 h-7 w-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/70 backdrop-blur-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => confirmDelete(w.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex flex-col flex-1 px-4 pt-3 pb-4 gap-3">
                    <div>
                      <p className="font-semibold text-sm leading-snug truncate">{w.name}</p>
                      {w.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{w.description}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground/40 mt-0.5 italic">No description</p>
                      )}
                    </div>

                    <div className="flex gap-2 mt-auto">
                      <Button
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          onAddToCanvas(w.id);
                          onOpenChange(false);
                        }}
                      >
                        Add to canvas
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="px-2.5"
                        onClick={() => handleEdit(w.id)}
                        title="Edit code"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="public" className="flex-1 overflow-y-auto mt-4 space-y-4">
            <Input
              placeholder="Search widgets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />

            {loadingLibrary && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
            {!loadingLibrary && filteredLibrary.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {search ? "No widgets match your search." : "No approved widgets in the library yet."}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredLibrary.map((entry) => (
                <LibraryCard
                  key={entry.id}
                  entry={entry}
                  onInstall={() => handleInstall(entry.id)}
                  isInstalling={installingId === entry.id}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete widget?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the widget and all its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

