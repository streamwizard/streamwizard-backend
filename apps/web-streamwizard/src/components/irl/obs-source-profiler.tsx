"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Cpu,
  EyeOff,
  Filter as FilterIcon,
  Gauge,
  Layers,
  Monitor,
  Radio,
  Search,
  Tv2,
  Zap,
} from "lucide-react";
import { ScrollArea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@repo/ui";
import { cn } from "@repo/ui";
import type { SourceStatNode, SourceStatsPayload } from "@repo/obs-web";

// ─── types ──────────────────────────────────────────────────────────────────

type SortKey = "total" | "cpu" | "gpu" | "name";
type ChildFilter = "all" | "sources" | "filters";

// ─── helpers ────────────────────────────────────────────────────────────────

function barColor(pct?: number) {
  if (!pct || pct < 0.01) return "bg-muted-foreground/20";
  if (pct >= 15) return "bg-red-500";
  if (pct >= 5) return "bg-amber-500";
  return "bg-green-500";
}

function pctColor(pct?: number) {
  if (!pct || pct < 0.01) return "text-muted-foreground/40";
  if (pct >= 15) return "text-red-400";
  if (pct >= 5) return "text-amber-400";
  return "text-green-400";
}

function fmt(pct?: number) {
  return pct !== undefined ? `${pct.toFixed(1)}%` : "—";
}

function sortNodes(nodes: SourceStatNode[], key: SortKey): SourceStatNode[] {
  const copy = [...nodes];
  if (key === "name") return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (key === "cpu") return copy.sort((a, b) => (b.cpuPercentage ?? 0) - (a.cpuPercentage ?? 0));
  if (key === "gpu") return copy.sort((a, b) => (b.gpuPercentage ?? 0) - (a.gpuPercentage ?? 0));
  return copy.sort((a, b) => (b.totalPercentage ?? 0) - (a.totalPercentage ?? 0));
}

function matchesSearch(node: SourceStatNode, q: string) {
  if (!q) return true;
  const lq = q.toLowerCase();
  return (
    node.name.toLowerCase().includes(lq) ||
    (node.displayName?.toLowerCase().includes(lq) ?? false) ||
    (node.kindId?.toLowerCase().includes(lq) ?? false)
  );
}

function hasMatch(node: SourceStatNode, q: string): boolean {
  if (matchesSearch(node, q)) return true;
  return node.children?.some((c) => hasMatch(c, q)) ?? false;
}

// ─── sub-components ─────────────────────────────────────────────────────────

function NodeIcon({ category, kindId }: { category: string; kindId?: string }) {
  if (category === "scene") return <Monitor className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
  if (category === "filter") return <FilterIcon className="h-3.5 w-3.5 text-purple-400 shrink-0" />;
  if (category === "group") return <Layers className="h-3.5 w-3.5 text-yellow-400 shrink-0" />;
  if (kindId === "browser_source") return <Zap className="h-3.5 w-3.5 text-cyan-400 shrink-0" />;
  if (kindId?.includes("dshow") || kindId?.includes("v4l2")) return <Tv2 className="h-3.5 w-3.5 text-pink-400 shrink-0" />;
  return <Cpu className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />;
}

function PctBar({ pct }: { pct?: number }) {
  const w = pct ? Math.min((pct / 25) * 100, 100) : 0;
  return (
    <div className="h-[3px] w-full bg-muted/40 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500", barColor(pct))}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

function PctCell({ pct }: { pct?: number }) {
  return (
    <div className="shrink-0 w-[52px] flex flex-col gap-[3px]">
      <span className={cn("text-[10px] font-mono tabular-nums leading-none text-right", pctColor(pct))}>
        {fmt(pct)}
      </span>
      <PctBar pct={pct} />
    </div>
  );
}

// ─── NodeRow ────────────────────────────────────────────────────────────────

interface NodeRowProps {
  node: SourceStatNode;
  depth: number;
  sortKey: SortKey;
  childFilter: ChildFilter;
  search: string;
  parentSceneName?: string;
  parentSourceName?: string;
  onSetSceneItemEnabled: (scene: string, uuid: string, enabled: boolean) => Promise<void>;
  onSetSourceFilterEnabled: (source: string, filter: string, enabled: boolean) => Promise<void>;
}

function NodeRow({
  node, depth, sortKey, childFilter, search,
  parentSceneName, parentSourceName,
  onSetSceneItemEnabled, onSetSourceFilterEnabled,
}: NodeRowProps) {
  const [open, setOpen] = useState(true);
  const [toggling, setToggling] = useState(false);

  const isScene = node.category === "scene";
  const isFilter = node.category === "filter";
  const sceneName = isScene ? node.name : parentSceneName;
  const sourceName = isFilter ? (parentSourceName ?? node.name) : node.name;

  const visibleChildren = useMemo(() => {
    let kids = (node.children ?? []).filter((c) => !c.private);
    if (search) kids = kids.filter((c) => hasMatch(c, search));
    if (childFilter === "sources") kids = kids.filter((c) => c.category !== "filter");
    if (childFilter === "filters") kids = kids.filter((c) => c.category === "filter");
    return sortNodes(kids, sortKey);
  }, [node.children, search, childFilter, sortKey]);

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      if (isFilter && parentSourceName) {
        await onSetSourceFilterEnabled(parentSourceName, node.name, checked);
      } else if (node.uuid && parentSceneName) {
        await onSetSceneItemEnabled(parentSceneName, node.uuid, checked);
      }
    } finally {
      setToggling(false);
    }
  };

  const dimmed = search && !matchesSearch(node, search);

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1.5 py-[5px] pr-2 rounded-md transition-colors",
          "hover:bg-white/[0.03]",
          isScene && "mt-1.5 first:mt-0 border-l-2 border-blue-500/25 bg-muted/[0.04]",
          dimmed && "opacity-40",
        )}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
      >
        {/* chevron */}
        <button
          onClick={() => setOpen((p) => !p)}
          className={cn(
            "shrink-0 w-4 h-4 flex items-center justify-center rounded text-muted-foreground/40",
            "hover:text-muted-foreground transition-colors",
            visibleChildren.length === 0 && "invisible pointer-events-none",
          )}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open
            ? <ChevronDown className="h-3 w-3" />
            : <ChevronRight className="h-3 w-3" />}
        </button>

        <NodeIcon category={node.category} kindId={node.kindId} />

        {/* name + kind */}
        <div className="flex-1 min-w-0 flex items-baseline gap-1.5 overflow-hidden">
          <span className={cn(
            "text-xs truncate leading-none",
            isScene ? "font-semibold text-foreground" : "text-foreground/80",
          )}>
            {node.name}
          </span>
          {node.displayName && !isScene && (
            <span className="text-[10px] text-muted-foreground/45 shrink-0 truncate hidden sm:block">
              {node.displayName}
            </span>
          )}
        </div>

        {/* async fps */}
        {node.async && node.asyncRenderedFps !== undefined && (
          <span className="text-[10px] font-mono text-cyan-500/60 shrink-0 hidden md:block">
            {node.asyncRenderedFps.toFixed(0)}fps
          </span>
        )}

        {/* live dot */}
        {node.active
          ? <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          : <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
        }

        <PctCell pct={node.cpuPercentage} />
        <PctCell pct={node.gpuPercentage} />

        {/* toggle */}
        <div className="shrink-0 w-8 flex justify-end">
          {isScene ? null : toggling ? (
            <EyeOff className="h-3 w-3 text-muted-foreground/30 animate-pulse" />
          ) : (
            <Switch
              checked={node.enabled}
              onCheckedChange={handleToggle}
              className="scale-[0.6] origin-right"
              aria-label={`Toggle ${node.name}`}
            />
          )}
        </div>
      </div>

      {open && visibleChildren.map((child, i) => (
        <NodeRow
          key={`${child.name}-${child.category}-${i}`}
          node={child}
          depth={depth + 1}
          sortKey={sortKey}
          childFilter={childFilter}
          search={search}
          parentSceneName={sceneName}
          parentSourceName={isFilter ? sourceName : node.name}
          onSetSceneItemEnabled={onSetSceneItemEnabled}
          onSetSourceFilterEnabled={onSetSourceFilterEnabled}
        />
      ))}
    </>
  );
}

// ─── main component ─────────────────────────────────────────────────────────

interface ObsSourceProfilerProps {
  sourceStats: SourceStatsPayload | null;
  onSetSceneItemEnabled: (scene: string, uuid: string, enabled: boolean) => Promise<void>;
  onSetSourceFilterEnabled: (source: string, filter: string, enabled: boolean) => Promise<void>;
}

const SORT_OPTS: { key: SortKey; label: string }[] = [
  { key: "total", label: "Total %" },
  { key: "cpu",   label: "CPU %"   },
  { key: "gpu",   label: "GPU %"   },
  { key: "name",  label: "Name"    },
];

const FILTER_OPTS: { key: ChildFilter; label: string }[] = [
  { key: "all",     label: "All"     },
  { key: "sources", label: "Sources" },
  { key: "filters", label: "Filters" },
];

export function ObsSourceProfiler({ sourceStats, onSetSceneItemEnabled, onSetSourceFilterEnabled }: ObsSourceProfilerProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [childFilter, setChildFilter] = useState<ChildFilter>("all");

  const topLevel = useMemo(() => {
    if (!sourceStats) return [];
    let nodes = sourceStats.sources.filter((s) => !s.private);
    // The plugin sends all items at the top level of `sources`.
    // If scenes are present, use only them as roots so sources/filters
    // appear nested under their parent scene via the children arrays.
    const scenes = nodes.filter((n) => n.category === "scene");
    if (scenes.length > 0) nodes = scenes;
    if (search) nodes = nodes.filter((s) => hasMatch(s, search));
    return sortNodes(nodes, sortKey);
  }, [sourceStats, search, sortKey]);

  if (!sourceStats) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-4">
        <Cpu className="h-9 w-9 text-muted-foreground/25" />
        <p className="text-sm font-medium text-muted-foreground">No source profiler data</p>
        <p className="text-xs text-muted-foreground/55 max-w-xs leading-relaxed">
          Connect to OBS and enable the Source Profiler plugin with &ldquo;Send over WebSocket&rdquo; to see per-source metrics here.
        </p>
      </div>
    );
  }

  const totalCpu = topLevel.reduce((s, n) => s + (n.cpuPercentage ?? 0), 0);
  const totalGpu = topLevel.reduce((s, n) => s + (n.gpuPercentage ?? 0), 0);
  const activeCount = topLevel.filter((n) => n.active).length;

  return (
    <div className="flex flex-col">

      {/* ── summary bar ── */}
      <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/20 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Radio className="h-3 w-3 text-green-400" />
          <span className="font-mono tabular-nums">{activeCount} live</span>
        </span>
        <span className="flex items-center gap-1">
          <Cpu className="h-3 w-3 text-muted-foreground/50" />
          <span className={cn("font-mono tabular-nums", pctColor(totalCpu))}>
            {fmt(totalCpu)}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Gauge className="h-3 w-3 text-muted-foreground/50" />
          <span className={cn("font-mono tabular-nums", pctColor(totalGpu))}>
            {fmt(totalGpu)}
          </span>
        </span>
        <span className="ml-auto font-mono tabular-nums text-muted-foreground/50">
          {sourceStats.frameTime.toFixed(2)} ms/frame
        </span>
      </div>

      {/* ── toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        {/* search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter sources…"
            className={cn(
              "w-full pl-6 pr-2 py-1 text-xs rounded-md",
              "bg-muted/40 border border-transparent",
              "focus:outline-none focus:border-border/60",
              "placeholder:text-muted-foreground/35",
            )}
          />
        </div>
        {/* sort */}
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger size="sm" className="h-[26px] shrink-0 text-xs" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {SORT_OPTS.map((o) => (
              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── filter pills ── */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b">
        {FILTER_OPTS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setChildFilter(opt.key)}
            className={cn(
              "text-[10px] font-medium px-2.5 py-0.5 rounded-full transition-colors cursor-pointer",
              childFilter === opt.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted/80",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── column headers ── */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b text-[10px] font-medium text-muted-foreground/50">
        <span className="w-4 shrink-0" />
        <span className="w-3.5 shrink-0" />
        <span className="flex-1">Source</span>
        <span className="w-4 shrink-0" />
        <span className="w-[52px] text-right shrink-0">CPU</span>
        <span className="w-[52px] text-right shrink-0">GPU</span>
        <span className="w-8 shrink-0" />
      </div>

      {/* ── tree ── */}
      <ScrollArea className="h-[280px]">
        <div className="px-2 py-1">
          {topLevel.length === 0 ? (
            <p className="text-xs text-muted-foreground/40 text-center py-10">
              {search ? `No sources matching "${search}"` : "No sources"}
            </p>
          ) : (
            topLevel.map((node, i) => (
              <NodeRow
                key={`${node.name}-${i}`}
                node={node}
                depth={0}
                sortKey={sortKey}
                childFilter={childFilter}
                search={search}
                onSetSceneItemEnabled={onSetSceneItemEnabled}
                onSetSourceFilterEnabled={onSetSourceFilterEnabled}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
