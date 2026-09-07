"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@repo/ui";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Clapperboard,
  EllipsisVertical,
  Eye,
  Folder,
  FolderOpen,
  LayoutGrid,
  LayoutList,
  MoreHorizontal,
  PanelLeft,
  Play,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Star,
  User,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { CLIP_SORT_DEFAULT_ASC, type ClipSortKey } from "@/lib/utils/clip-sort";
import { ClipShowcaseDialog } from "./clips-marquee";
import { useDemoTracking } from "../analytics/use-demo-tracking";
import type { RealClipCard } from "./demo-data";

/*
 * /dashboard/clips, rebuilt on the landing page with real clips in it: the view
 * selector, the filter form, the sidebar folder tree, the folder dialogs and the
 * "Add to folder" waterfall off a clip's ⋮ menu.
 *
 * Everything visible is the product's own component (@repo/ui primitives, the
 * dashboard's date range picker, sonner toasts) arranged the way the dashboard
 * arranges it, and the copy is lifted from the same files: the filter form
 * (components/forms/twitch-clip-filter-form.tsx), the clip menu and card
 * (components/cards/clip-card.tsx), the details table
 * (components/clips/clips-details-view.tsx), the sidebar tree
 * (components/nav/sidebar-clips.tsx) and the folder dialogs
 * (providers/clip-folder-dialog-provider.tsx).
 *
 * The plumbing is where it differs: the dashboard keeps filter state in the URL
 * and re-queries Postgres, this filters the fetched clips in memory, and nothing
 * persists. One deliberate departure: folder counts are derived from
 * assignments, so a folder that says 3 opens on exactly three clips. The
 * advanced filter panel starts closed, as on the dashboard.
 *
 * It also narrows the way the dashboard does: below `md` the sidebar tree moves
 * into a drawer behind a PanelLeft trigger in the window chrome (the dashboard's
 * SidebarTrigger), and the clip grid drops to one column on phones. The drawer
 * is drawn inside the window frame rather than with the ui Sheet, which portals
 * to the body and would cover the visitor's whole screen instead of the mock.
 */

/* Keeps react-day-picker and date-fns out of the landing page's first load. */
const DatePickerWithPresets = dynamic(
  () => import("@/components/date-picker").then((mod) => mod.DatePickerWithPresets),
  { ssr: false },
);

interface MockFolder {
  id: string;
  name: string;
  children: MockFolder[];
}

const SEED_FOLDERS: MockFolder[] = [
  {
    id: "fails",
    name: "Fails",
    children: [
      { id: "fails-deaths", name: "Deaths", children: [] },
      { id: "fails-worst", name: "Certified worst", children: [] },
    ],
  },
  { id: "chat", name: "Chat moments", children: [] },
  { id: "irl", name: "IRL walks", children: [] },
  { id: "shorts", name: "Shorts queue", children: [] },
];

/* Enough pre-filed clips that folder filtering has something to show. */
const SEED_ASSIGNMENTS: Record<number, string[]> = {
  0: ["fails", "shorts"],
  1: ["chat"],
  2: ["fails-deaths"],
  3: ["irl"],
  4: ["chat", "shorts"],
  7: ["fails"],
};

/* The featured star is set elsewhere in the app, so the demo ships a couple
 * already starred rather than inventing a control for it. */
const SEED_FEATURED = [0, 5];

/* Every toast here fires the product's own copy, so the second line says out
 * loud that this one is a demo and nothing survives a reload. */
const DEMO_NOTE = { description: "Demo only. Nothing here is saved." } as const;

/* The product's folder name rule, from the dialog's zod schema. */
const FOLDER_NAME_PATTERN = /^[a-zA-Z0-9-_\s]+$/;

const SORT_COLUMNS: { key: ClipSortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "creator", label: "Creator" },
  { key: "game", label: "Game" },
  { key: "views", label: "Views" },
  { key: "date", label: "Date" },
  { key: "duration", label: "Duration" },
];

/* The dashboard at 90%: same components and same layout, dialed down a notch
 * because this runs inside a section on a marketing page. */
const FIELD_LABEL = "text-[10px]";
const CONTROL = "h-8 text-xs";

/* The dashboard's details grid, one notch narrower: this table lives in a card
 * on a marketing page, not across a full-width dashboard. */
const DETAILS_GRID =
  "grid grid-cols-[48px_minmax(130px,2.5fr)_minmax(80px,1fr)_minmax(80px,1fr)_56px_80px_56px_28px] items-center gap-x-2";

type DialogState =
  | { mode: null }
  | { mode: "create"; parentFolderId?: string; parentFolderName?: string }
  | { mode: "rename"; folderId: string; folderName: string }
  | { mode: "delete"; folderId: string; folderName: string; hasSubfolders: boolean };

interface DateRange {
  from?: Date;
  to?: Date;
}

function flattenFolders(nodes: MockFolder[]): MockFolder[] {
  return nodes.flatMap((node) => [node, ...flattenFolders(node.children)]);
}

function addChildFolder(nodes: MockFolder[], parentId: string, child: MockFolder): MockFolder[] {
  return nodes.map((node) =>
    node.id === parentId
      ? { ...node, children: [...node.children, child] }
      : { ...node, children: addChildFolder(node.children, parentId, child) },
  );
}

function renameFolderNode(nodes: MockFolder[], id: string, name: string): MockFolder[] {
  return nodes.map((node) =>
    node.id === id ? { ...node, name } : { ...node, children: renameFolderNode(node.children, id, name) },
  );
}

function removeFolderNode(nodes: MockFolder[], id: string): MockFolder[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: removeFolderNode(node.children, id) }));
}

/** "1:04" → 64, so the details table can sort on duration like the product. */
function durationSeconds(duration: string): number {
  const [minutes, seconds] = duration.split(":").map(Number);
  return (minutes || 0) * 60 + (seconds || 0);
}

/** Recursive "Add to folder" menu, mirroring AddToFolderItems in the product. */
function AddToFolderItems({
  nodes,
  assignedIds,
  onAdd,
}: {
  nodes: MockFolder[];
  assignedIds: string[];
  onAdd: (folder: MockFolder) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isAssigned = assignedIds.includes(node.id);

        if (node.children.length > 0) {
          return (
            <DropdownMenuSub key={node.id}>
              <DropdownMenuSubTrigger>
                <Folder className="mr-2 size-4 text-muted-foreground" />
                {node.name}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem disabled={isAssigned} onClick={() => onAdd(node)}>
                    {isAssigned ? `Already in ${node.name}` : `Add to ${node.name}`}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <AddToFolderItems nodes={node.children} assignedIds={assignedIds} onAdd={onAdd} />
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          );
        }

        return (
          <DropdownMenuItem key={node.id} disabled={isAssigned} onClick={() => onAdd(node)}>
            <Folder className="mr-2 size-4 text-muted-foreground" />
            {node.name}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

/** The ⋮ menu from the product's clip card, minus the actions that need a login. */
function ClipActionsMenu({
  clipTitle,
  folders,
  assigned,
  folderName,
  onAdd,
  onRemove,
  onOpen,
  className,
}: {
  clipTitle: string;
  folders: MockFolder[];
  assigned: string[];
  folderName: (id: string) => string;
  onAdd: (folder: MockFolder) => void;
  onRemove: (folderId: string) => void;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) onOpen();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("size-6 shrink-0 p-0", className)}>
          <MoreHorizontal className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Clip options for {clipTitle}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Folders</DropdownMenuLabel>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Add to folder</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {folders.length === 0 ? (
                  <DropdownMenuItem disabled>No folders yet</DropdownMenuItem>
                ) : (
                  <AddToFolderItems nodes={folders} assignedIds={assigned} onAdd={onAdd} />
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Remove from folder</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {assigned.length === 0 ? (
                  <DropdownMenuItem disabled>No folders available</DropdownMenuItem>
                ) : (
                  assigned.map((id) => (
                    <DropdownMenuItem key={id} onClick={() => onRemove(id)}>
                      {folderName(id)}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem disabled>Download Landscape</DropdownMenuItem>
        <DropdownMenuItem disabled>Download Portrait</DropdownMenuItem>
        <DropdownMenuItem disabled>Copy URL to clipboard</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FolderRow({
  folder,
  depth,
  counts,
  activeId,
  onSelect,
  onCreateChild,
  onRename,
  onDelete,
}: {
  folder: MockFolder;
  depth: number;
  counts: Record<string, number>;
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreateChild: (folder: MockFolder) => void;
  onRename: (folder: MockFolder) => void;
  onDelete: (folder: MockFolder) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = folder.children.length > 0;
  const isActive = activeId === folder.id;

  return (
    <li className="list-none">
      <div
        className="group/row relative flex items-center rounded-md pr-1 hover:bg-sidebar-accent"
        style={{ paddingLeft: depth * 10 }}
      >
        <span className="flex w-4 shrink-0 items-center justify-center">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              className="flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
              aria-label={isOpen ? "Collapse folder" : "Expand folder"}
            >
              <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
            </button>
          ) : null}
        </span>
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          aria-pressed={isActive}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1 pr-1 text-left text-xs",
            isActive
              ? "font-medium text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:text-sidebar-accent-foreground",
          )}
        >
          {isActive ? (
            <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Folder className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">{folder.name}</span>
          <span className="ml-auto pl-1 font-mono text-[10px] tabular-nums text-muted-foreground transition-opacity group-hover/row:opacity-0">
            {counts[folder.id] ?? 0}
          </span>
        </button>
        {/* Floated over the row's right edge instead of sitting in the flow, so
            the folder name keeps the full width of the tree. */}
        <span className="absolute inset-y-0 right-0 flex items-center gap-0.5 rounded-md bg-sidebar-accent pl-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100 has-[[data-state=open]]:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onClick={() => onCreateChild(folder)}
          >
            <Plus className="size-3.5" />
            <span className="sr-only">New subfolder in {folder.name}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0">
                <EllipsisVertical className="size-3.5" />
                <span className="sr-only">Folder actions for {folder.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Folder Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onCreateChild(folder)}>New subfolder</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(folder)}>Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(folder)}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>

      {hasChildren && isOpen ? (
        <ul className="list-none">
          {folder.children.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              depth={depth + 1}
              counts={counts}
              activeId={activeId}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Create / rename dialog: same shape and copy as the product's. */
function FolderDialog({
  state,
  onClose,
  onSubmit,
}: {
  state: DialogState;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const isOpen = state.mode === "create" || state.mode === "rename";
  const isRename = state.mode === "rename";
  const parentFolderName = state.mode === "create" ? state.parentFolderName : undefined;
  const seedName = state.mode === "rename" ? state.folderName : "";

  /* Remounted by the parent whenever the target folder changes, so the field
   * seeds itself instead of syncing through an effect. */
  const [name, setName] = useState(seedName);
  const [error, setError] = useState<string | null>(null);

  const title = isRename ? "Rename Folder" : parentFolderName ? "Create Subfolder" : "Create Folder";
  const description = isRename
    ? "Enter a new name for this folder."
    : parentFolderName
      ? `This subfolder will be created inside "${parentFolderName}".`
      : "Enter a name for your new folder.";

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      setError("Folder name must be at least 1 character.");
      return;
    }
    if (!FOLDER_NAME_PATTERN.test(trimmed)) {
      setError("Folder name can only contain letters, numbers, spaces, hyphens, and underscores.");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field>
            <FieldLabel htmlFor="mock-folder-name">Folder Name</FieldLabel>
            <Input
              id="mock-folder-name"
              autoFocus
              value={name}
              maxLength={255}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              placeholder={parentFolderName ? `Inside ${parentFolderName}` : "My New Folder"}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{isRename ? "Rename" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Delete confirmation: same shape and copy as the product's. */
function DeleteFolderDialog({
  state,
  onClose,
  onConfirm,
}: {
  state: DialogState;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isOpen = state.mode === "delete";
  const folderName = state.mode === "delete" ? state.folderName : "";
  const hasSubfolders = state.mode === "delete" ? state.hasSubfolders : false;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete &quot;{folderName}&quot;?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The folder will be deleted, but clips inside it will remain available outside
            of this folder.
            {hasSubfolders ? " Any subfolders inside it will also be deleted." : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortHeader({
  label,
  column,
  isActive,
  ascending,
  onSort,
}: {
  label: string;
  column: ClipSortKey;
  isActive: boolean;
  ascending: boolean;
  onSort: (column: ClipSortKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "flex items-center gap-1 text-left uppercase transition-colors hover:text-foreground",
        isActive ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span>{label}</span>
      {isActive ? (
        ascending ? (
          <ArrowUp className="size-3 shrink-0" aria-hidden />
        ) : (
          <ArrowDown className="size-3 shrink-0" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="size-3 shrink-0 opacity-40" aria-hidden />
      )}
    </button>
  );
}

export function ClipFoldersMock({ clips }: { clips: RealClipCard[] }) {
  const [folders, setFolders] = useState<MockFolder[]>(SEED_FOLDERS);
  const [assignments, setAssignments] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(clips.map((clip, index) => [clip.id, SEED_ASSIGNMENTS[index] ?? []])),
  );
  const featuredIds = useMemo(() => new Set(SEED_FEATURED.map((index) => clips[index]?.id).filter(Boolean)), [clips]);

  const track = useDemoTracking("clips");
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ mode: null });
  /* Index into the currently visible list, so paging inside the player walks
   * the same clips the filters left on screen. */
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  /* The nudge on the first ⋮ retires once a visitor has opened any menu. */
  const [hasOpenedMenu, setHasOpenedMenu] = useState(false);

  const [view, setView] = useState<"grid" | "details">("grid");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [broadcaster, setBroadcaster] = useState("");
  const [creator, setCreator] = useState("");
  const [dateValue, setDateValue] = useState<DateRange | undefined>(undefined);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] = useState<ClipSortKey>("date");
  const [ascending, setAscending] = useState(false);
  // Advanced panel starts closed, as on the dashboard.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The sidebar drawer below `md`, like the dashboard's mobile sidebar.
  const [treeOpen, setTreeOpen] = useState(false);

  useEffect(() => {
    if (!treeOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTreeOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [treeOpen]);

  const flat = useMemo(() => flattenFolders(folders), [folders]);
  const folderName = useCallback((id: string) => flat.find((folder) => folder.id === id)?.name ?? "folder", [flat]);

  const categories = useMemo(
    () => [...new Set(clips.map((clip) => clip.category).filter(Boolean) as string[])].sort(),
    [clips],
  );
  const broadcasters = useMemo(
    () => [...new Set(clips.map((clip) => clip.broadcaster))].sort((a, b) => a.localeCompare(b)),
    [clips],
  );
  const creators = useMemo(
    () => [...new Set(clips.map((clip) => clip.creator))].sort((a, b) => a.localeCompare(b)),
    [clips],
  );

  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const ids of Object.values(assignments)) {
      for (const id of ids) next[id] = (next[id] ?? 0) + 1;
    }
    return next;
  }, [assignments]);

  const addToFolder = (clipId: string, folder: MockFolder) => {
    setAssignments((prev) => ({ ...prev, [clipId]: [...(prev[clipId] ?? []), folder.id] }));
    toast.success(`Clip added to ${folder.name}`, DEMO_NOTE);
  };

  const removeFromFolder = (clipId: string, folderId: string) => {
    setAssignments((prev) => ({
      ...prev,
      [clipId]: (prev[clipId] ?? []).filter((id) => id !== folderId),
    }));
    toast.success(`Clip removed from ${folderName(folderId)}`, DEMO_NOTE);
  };

  const submitFolderDialog = (name: string) => {
    track(`folder_${dialog.mode === "create" ? "created" : "renamed"}`);
    if (dialog.mode === "create") {
      const folder: MockFolder = { id: `new-${flat.length}-${name}`, name, children: [] };
      setFolders((prev) =>
        dialog.parentFolderId ? addChildFolder(prev, dialog.parentFolderId, folder) : [...prev, folder],
      );
      toast.success("Folder created successfully!", DEMO_NOTE);
    } else if (dialog.mode === "rename") {
      setFolders((prev) => renameFolderNode(prev, dialog.folderId, name));
      toast.success("Folder updated successfully!", DEMO_NOTE);
    }
    setDialog({ mode: null });
  };

  const confirmDeleteFolder = () => {
    if (dialog.mode !== "delete") return;
    const target = flat.find((folder) => folder.id === dialog.folderId);
    const removedIds = new Set(target ? flattenFolders([target]).map((folder) => folder.id) : []);

    setFolders((prev) => removeFolderNode(prev, dialog.folderId));
    setAssignments((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([clipId, ids]) => [clipId, ids.filter((id) => !removedIds.has(id))]),
      ),
    );
    setActiveFolderId((current) => (current && removedIds.has(current) ? null : current));
    toast.success("Folder deleted successfully", DEMO_NOTE);
    setDialog({ mode: null });
  };

  const resetFilters = () => {
    setSearch("");
    setCategory("");
    setBroadcaster("");
    setCreator("");
    setDateValue(undefined);
    setFeaturedOnly(false);
    setSort("date");
    setAscending(false);
  };

  const handleSort = (column: ClipSortKey) => {
    track("sorted");
    if (sort === column) {
      setAscending((previous) => !previous);
      return;
    }
    setSort(column);
    setAscending(CLIP_SORT_DEFAULT_ASC[column]);
  };

  const visibleClips = useMemo(() => {
    const query = search.trim().toLowerCase();
    const from = dateValue?.from?.getTime();
    const to = dateValue?.to?.getTime();

    const filtered = clips.filter((clip) => {
      if (activeFolderId && !(assignments[clip.id] ?? []).includes(activeFolderId)) return false;
      if (query && !clip.title.toLowerCase().includes(query)) return false;
      if (category && clip.category !== category) return false;
      if (broadcaster && clip.broadcaster !== broadcaster) return false;
      if (creator && clip.creator !== creator) return false;
      if (featuredOnly && !featuredIds.has(clip.id)) return false;
      if (from || to) {
        const created = clip.createdAt ? Date.parse(clip.createdAt) : NaN;
        if (!Number.isFinite(created)) return false;
        if (from && created < from) return false;
        /* The picker hands back midnight, so the end day still counts in full. */
        if (to && created > to + 24 * 60 * 60 * 1000) return false;
      }
      return true;
    });

    const compare = (a: RealClipCard, b: RealClipCard): number => {
      switch (sort) {
        case "name":
          return a.title.localeCompare(b.title);
        case "creator":
          return a.creator.localeCompare(b.creator);
        case "game":
          return (a.category ?? "").localeCompare(b.category ?? "");
        case "views":
          return a.views - b.views;
        case "duration":
          return durationSeconds(a.duration) - durationSeconds(b.duration);
        default:
          return Date.parse(a.createdAt ?? "") - Date.parse(b.createdAt ?? "") || 0;
      }
    };

    return filtered.sort((a, b) => {
      const delta = compare(a, b);
      const safe = Number.isFinite(delta) ? delta : 0;
      return ascending ? safe : -safe;
    });
  }, [
    clips,
    assignments,
    activeFolderId,
    search,
    category,
    broadcaster,
    creator,
    featuredOnly,
    featuredIds,
    dateValue,
    sort,
    ascending,
  ]);

  /* The dashboard's chip row: same labels, same clear-one-filter behaviour. */
  const chips = [
    category ? { key: "category", label: `Category: ${category}` } : null,
    broadcaster ? { key: "broadcaster", label: `Streamer: ${broadcaster}` } : null,
    creator ? { key: "creator", label: `Clipped by: ${creator}` } : null,
    search.trim() ? { key: "search", label: `"${search.trim()}"` } : null,
    dateValue?.from
      ? {
          key: "date",
          label: `${dateValue.from.toLocaleDateString()}${
            dateValue.to ? ` → ${dateValue.to.toLocaleDateString()}` : ""
          }`,
        }
      : null,
    featuredOnly ? { key: "featured", label: "Featured only" } : null,
    sort === "views" ? { key: "sort", label: "Sort: Views" } : null,
    ascending ? { key: "asc", label: "↑ Ascending" } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  const clearChip = (key: string) => {
    if (key === "category") setCategory("");
    if (key === "broadcaster") setBroadcaster("");
    if (key === "creator") setCreator("");
    if (key === "search") setSearch("");
    if (key === "date") setDateValue(undefined);
    if (key === "featured") setFeaturedOnly(false);
    if (key === "sort") setSort("date");
    if (key === "asc") setAscending(false);
  };

  const clipMenuProps = (clip: RealClipCard) => ({
    clipTitle: clip.title,
    folders,
    assigned: assignments[clip.id] ?? [],
    folderName,
    onAdd: (folder: MockFolder) => addToFolder(clip.id, folder),
    onRemove: (folderId: string) => removeFromFolder(clip.id, folderId),
    onOpen: () => setHasOpenedMenu(true),
  });

  /* Same tree for the sidebar column and the phone sheet; picking a folder
     closes the sheet, as the dashboard's sidebar does. */
  const tree = (
    <>
      <button
        type="button"
        onClick={() => {
          setActiveFolderId(null);
          setTreeOpen(false);
        }}
        aria-pressed={activeFolderId === null}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-sidebar-accent",
          activeFolderId === null ? "font-medium text-foreground" : "text-sidebar-foreground",
        )}
      >
        <Clapperboard className="size-4 shrink-0" aria-hidden="true" />
        Clips
        <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">{clips.length}</span>
      </button>

      <div className="mt-1 flex items-center gap-2 px-2 py-1">
        <FolderOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs text-sidebar-foreground">Folders</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-6 shrink-0"
          onClick={() => setDialog({ mode: "create" })}
        >
          <Plus className="size-3.5" />
          <span className="sr-only">Create new folder</span>
        </Button>
      </div>

      <ul className="list-none py-0.5">
        {folders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            depth={0}
            counts={counts}
            activeId={activeFolderId}
            onSelect={(id) => {
              track("folder_selected");
              setActiveFolderId((current) => (current === id ? null : id));
              setTreeOpen(false);
            }}
            onCreateChild={(parent) =>
              setDialog({ mode: "create", parentFolderId: parent.id, parentFolderName: parent.name })
            }
            onRename={(target) => setDialog({ mode: "rename", folderId: target.id, folderName: target.name })}
            onDelete={(target) =>
              setDialog({
                mode: "delete",
                folderId: target.id,
                folderName: target.name,
                hasSubfolders: target.children.length > 0,
              })
            }
          />
        ))}
      </ul>
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative overflow-hidden rounded-2xl border bg-card/40">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
          </span>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            streamwizard.org/dashboard/clips
            {activeFolderId ? `/${folderName(activeFolderId).toLowerCase().replace(/\s+/g, "-")}` : ""}
          </span>
        </div>

        {/* Tree on the left from `md`, like the dashboard's sidebar; below that
            it lives in the sheet and the clips take the full width. */}
        <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
          {/* Sidebar, same tree as the dashboard's; a sheet below `md` */}
          <div className="hidden border-r border-border/60 p-2 md:block">{tree}</div>

          {/* The clips page itself */}
          <div className="min-w-0 p-3">
            {/* Page header: the sidebar trigger from the dashboard's SiteHeader
                (phones only), the view selector as on /dashboard/clips */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 md:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() => setTreeOpen(true)}
                >
                  <PanelLeft className="size-4" aria-hidden="true" />
                  <span className="sr-only">Open folders</span>
                </Button>
                <span className="h-4 w-px bg-border" aria-hidden="true" />
              </div>
              <ToggleGroup
                className="ml-auto"
                type="single"
                variant="outline"
                size="sm"
                spacing={0}
                value={view}
                onValueChange={(next) => {
                  if (!next) return;
                  track(`view_${next}`);
                  setView(next as "grid" | "details");
                }}
              >
                <ToggleGroupItem
                  value="grid"
                  aria-label="Grid view"
                  className="gap-1.5 bg-accent px-3 text-accent-foreground hover:bg-accent/80 data-[state=on]:bg-transparent data-[state=on]:text-foreground"
                >
                  <LayoutGrid className="size-4" />
                  <span className="hidden sm:inline">Grid</span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="details"
                  aria-label="Details view"
                  className="gap-1.5 bg-accent px-3 text-accent-foreground hover:bg-accent/80 data-[state=on]:bg-transparent data-[state=on]:text-foreground"
                >
                  <LayoutList className="size-4" />
                  <span className="hidden sm:inline">Details</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Filter form */}
            <div className="space-y-3">
              {chips.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {chips.map((chip) => (
                      <Badge key={chip.key} variant="secondary" className="h-7 gap-1 pr-1 text-xs">
                        {chip.label}
                        <button
                          type="button"
                          onClick={() => clearChip(chip.key)}
                          className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                          aria-label={`Remove ${chip.label} filter`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    Clear all
                  </Button>
                </div>
              ) : null}

              <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="space-y-3">
                <div className="flex w-full flex-wrap items-end gap-3">
                  <Field className="w-full min-w-[150px] flex-1">
                    <FieldLabel htmlFor="mock-search" className={FIELD_LABEL}>
                      Search
                    </FieldLabel>
                    <Input
                      id="mock-search"
                      value={search}
                      onChange={(event) => {
                        track("searched");
                        setSearch(event.target.value);
                      }}
                      placeholder="Search clips..."
                      autoComplete="off"
                    />
                  </Field>

                  <Field className="w-full min-w-[150px] flex-1">
                    <FieldLabel htmlFor="mock-category" className={FIELD_LABEL}>
                      Category
                    </FieldLabel>
                    <Select value={category || "all"} onValueChange={(next) => setCategory(next === "all" ? "" : next)}>
                      <SelectTrigger id="mock-category" size="sm" className={cn("w-full", CONTROL)}>
                        <SelectValue placeholder="Enter Twitch category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any category</SelectItem>
                        {categories.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <div className="flex w-full gap-2 self-end sm:w-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 sm:w-auto"
                      onClick={() => setFiltersOpen((open) => !open)}
                      aria-expanded={filtersOpen}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters
                      {chips.length > 0 && (
                        <Badge className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs">
                          {chips.length}
                        </Badge>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => toast.info("Sync needs an account. This page is just very convincing.")}
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span className="hidden sm:inline">Sync</span>
                    </Button>
                  </div>
                </div>

                <CollapsibleContent className="mt-3">
                  <FieldGroup className="space-y-3 rounded-lg border bg-card p-2.5">
                    <div className="flex flex-wrap items-end gap-3">
                      <Field className="w-full min-w-[140px] flex-1">
                        <FieldLabel htmlFor="mock-broadcaster" className={FIELD_LABEL}>
                          Streamer
                        </FieldLabel>
                        <Select
                          value={broadcaster || "all"}
                          onValueChange={(next) => setBroadcaster(next === "all" ? "" : next)}
                        >
                          <SelectTrigger id="mock-broadcaster" size="sm" className={cn("w-full", CONTROL)}>
                            <SelectValue placeholder="Enter Twitch Username" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any streamer</SelectItem>
                            {broadcasters.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field className="w-full min-w-[140px] flex-1">
                        <FieldLabel htmlFor="mock-creator" className={FIELD_LABEL}>
                          Clipped by
                        </FieldLabel>
                        <Select
                          value={creator || "all"}
                          onValueChange={(next) => setCreator(next === "all" ? "" : next)}
                        >
                          <SelectTrigger id="mock-creator" size="sm" className={cn("w-full", CONTROL)}>
                            <SelectValue placeholder="Enter Twitch Username" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Anyone</SelectItem>
                            {creators.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <DatePickerWithPresets
                        label="Date Range"
                        className="w-full min-w-[140px] flex-1"
                        value={dateValue}
                        onChange={(range) => setDateValue(range)}
                      />
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border/50 pt-2">
                      <label htmlFor="mock-featured" className="flex cursor-pointer items-center gap-2">
                        <Switch id="mock-featured" checked={featuredOnly} onCheckedChange={setFeaturedOnly} />
                        <span className="text-xs font-normal">Featured only</span>
                      </label>

                      <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Sort by
                          </span>
                          <ToggleGroup
                            type="single"
                            variant="outline"
                            value={sort === "views" ? "views" : "date"}
                            onValueChange={(next) => next && handleSort(next as ClipSortKey)}
                            className="w-full"
                          >
                            <ToggleGroupItem value="date" aria-label="Sort by date" className="h-8 flex-1 text-xs">
                              Date
                            </ToggleGroupItem>
                            <ToggleGroupItem value="views" aria-label="Sort by views" className="h-8 flex-1 text-xs">
                              Views
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </div>

                        <div className="mb-0.5 hidden h-7 w-px self-end bg-border sm:block" aria-hidden="true" />

                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Order
                          </span>
                          <ToggleGroup
                            type="single"
                            variant="outline"
                            value={ascending ? "asc" : "desc"}
                            onValueChange={(next) => next && setAscending(next === "asc")}
                            className="w-full"
                          >
                            <ToggleGroupItem value="asc" aria-label="Ascending" className="h-8 flex-1 text-xs">
                              ↑ Asc
                            </ToggleGroupItem>
                            <ToggleGroupItem value="desc" aria-label="Descending" className="h-8 flex-1 text-xs">
                              ↓ Desc
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </div>
                      </div>
                    </div>
                  </FieldGroup>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <p className="mb-2 mt-3 text-[11px] text-muted-foreground">
              Showing {visibleClips.length} of {clips.length} clips
              {activeFolderId ? ` in ${folderName(activeFolderId)}` : ""}
            </p>

            {visibleClips.length === 0 ? (
              <p className="px-1 py-10 text-center text-sm text-muted-foreground">
                No clips match those filters. Drop one, or file a clip in here from its ⋮ menu.
              </p>
            ) : view === "details" ? (
              <div className="max-h-[380px] overflow-hidden rounded-lg border border-border bg-card/50">
                <div className="max-h-[380px] overflow-auto">
                  <div className="min-w-[560px]">
                    <div
                      className={cn(
                        DETAILS_GRID,
                        "border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-medium tracking-wide",
                      )}
                    >
                      <span aria-hidden />
                      {SORT_COLUMNS.map(({ key, label }) => (
                        <SortHeader
                          key={key}
                          label={label}
                          column={key}
                          isActive={sort === key}
                          ascending={sort === key ? ascending : false}
                          onSort={handleSort}
                        />
                      ))}
                      <span aria-hidden />
                    </div>

                    {visibleClips.map((clip, index) => (
                      <div
                        key={clip.id}
                        onClick={() => setPlayingIndex(index)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setPlayingIndex(index);
                          }
                        }}
                        aria-label={`Play clip: ${clip.title}`}
                        className={cn(
                          DETAILS_GRID,
                          "group cursor-pointer border-b border-border/50 px-3 py-2 transition-colors last:border-b-0 hover:bg-accent/30",
                        )}
                      >
                        <div className="relative h-9 w-14 shrink-0 overflow-hidden rounded border border-border bg-muted">
                          <Image src={clip.thumbnailUrl} alt="" fill sizes="56px" className="object-cover" />
                          {featuredIds.has(clip.id) ? (
                            <Star
                              className="absolute right-0.5 top-0.5 size-3 fill-yellow-500 text-yellow-500"
                              aria-hidden
                            />
                          ) : null}
                        </div>
                        <span className="min-w-0 truncate text-xs font-medium" title={clip.title}>
                          {clip.title}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{clip.creator}</span>
                        <span className="truncate text-xs text-muted-foreground">{clip.category ?? "—"}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {clip.views.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {clip.createdAt ? formatDate(clip.createdAt) : "—"}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">{clip.duration}</span>
                        <div
                          className="flex justify-end opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <ClipActionsMenu {...clipMenuProps(clip)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid max-h-[380px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  {visibleClips.map((clip, index) => {
                    const assigned = assignments[clip.id] ?? [];

                    return (
                      <motion.div
                        key={clip.id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={() => setPlayingIndex(index)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setPlayingIndex(index);
                          }
                        }}
                        aria-label={`Play clip: ${clip.title}`}
                        className="group h-fit cursor-pointer overflow-hidden rounded-lg border bg-card transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <div className="p-1.5">
                          <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-black">
                            <Image
                              src={clip.thumbnailUrl}
                              alt=""
                              fill
                              sizes="(max-width: 640px) 100vw, 200px"
                              className="object-cover"
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                              <Play
                                className="size-6 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100"
                                aria-hidden="true"
                              />
                            </span>
                            <Badge className="absolute left-1 top-1 h-4 bg-primary px-1 text-[9px] text-primary-foreground">
                              {clip.duration}
                            </Badge>
                            {featuredIds.has(clip.id) ? (
                              <Badge className="absolute bottom-1 left-1 h-4 bg-yellow-500 px-1 text-[9px] text-yellow-950">
                                <Star className="mr-0.5 h-2.5 w-2.5" />
                                Featured
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="px-2 pb-2">
                          <p className="line-clamp-1 text-[11px] font-semibold">{clip.title}</p>

                          <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                            <span className="flex min-w-0 items-center gap-1">
                              <User className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                              <span className="truncate">{clip.creator}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1">
                              <Eye className="h-2.5 w-2.5" aria-hidden="true" />
                              {clip.views.toLocaleString()}
                            </span>
                          </div>

                          <div
                            className="mt-1 flex items-center justify-between gap-1"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex min-h-[18px] min-w-0 flex-wrap gap-1">
                              <AnimatePresence initial={false}>
                                {assigned.map((id) => (
                                  <motion.span
                                    key={id}
                                    layout
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.18, ease: "easeOut" }}
                                  >
                                    <Badge variant="secondary" className="h-4 gap-1 px-1 text-[9px]">
                                      <Folder className="size-2.5" aria-hidden="true" />
                                      {folderName(id)}
                                    </Badge>
                                  </motion.span>
                                ))}
                              </AnimatePresence>
                            </div>

                            <ClipActionsMenu
                              {...clipMenuProps(clip)}
                              className={cn(index === 0 && !hasOpenedMenu && "text-purple-300 ring-1 ring-purple-400/50")}
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/60 px-3 py-1.5 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Try it: filter, sort, or ⋮ then add to folder
          </p>
        </div>

        {/* Phone sidebar drawer, kept inside the window frame */}
        <AnimatePresence>
          {treeOpen ? (
            <motion.div
              key="tree-drawer"
              className="absolute inset-0 z-20 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/50"
                onClick={() => setTreeOpen(false)}
                aria-label="Close folders"
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Folders"
                className="absolute inset-y-0 left-0 w-3/4 max-w-[260px] overflow-y-auto border-r border-border/60 bg-sidebar p-2 text-sidebar-foreground shadow-lg"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <div className="mb-1 flex items-center justify-between px-2 py-1">
                  <span className="text-xs font-medium text-foreground">Folders</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    autoFocus
                    onClick={() => setTreeOpen(false)}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">Close folders</span>
                  </Button>
                </div>
                {tree}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <ClipShowcaseDialog
        clips={visibleClips}
        index={playingIndex}
        onIndexChange={setPlayingIndex}
        onClose={() => setPlayingIndex(null)}
      />

      <FolderDialog
        key={dialog.mode === "rename" ? `rename-${dialog.folderId}` : (dialog.mode ?? "closed")}
        state={dialog}
        onClose={() => setDialog({ mode: null })}
        onSubmit={submitFolderDialog}
      />
      <DeleteFolderDialog state={dialog} onClose={() => setDialog({ mode: null })} onConfirm={confirmDeleteFolder} />
    </MotionConfig>
  );
}
