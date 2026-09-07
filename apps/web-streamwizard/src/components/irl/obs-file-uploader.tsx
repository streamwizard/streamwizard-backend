"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, FileIcon, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button, Progress } from "@repo/ui";
import { cn } from "@repo/ui";
import { toast } from "sonner";
import {
  deleteMediaFile,
  listMediaFiles,
  renameMediaFile,
  uploadMediaFile,
  type MediaFile,
} from "@/lib/media-actions";
import { formatBytes } from "@/lib/format";

interface Props {
  apiUrl: string | null;
  instanceId: string | null;
  isRunning: boolean;
}

interface Uploading {
  id: string;
  name: string;
  size: number;
  progress: number;
}

export function ObsFileUploader({ apiUrl, instanceId, isRunning }: Props) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [usedBytes, setUsedBytes] = useState(0);
  const [quotaBytes, setQuotaBytes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ready = Boolean(apiUrl && instanceId && isRunning);

  const refresh = useCallback(async () => {
    if (!apiUrl || !instanceId) return;
    setLoading(true);
    try {
      const listing = await listMediaFiles(apiUrl, instanceId);
      setFiles(listing.files);
      setUsedBytes(listing.used_bytes);
      setQuotaBytes(listing.quota_bytes);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, instanceId]);

  useEffect(() => {
    if (ready) void refresh();
    else {
      setFiles([]);
      setUsedBytes(0);
    }
  }, [ready, refresh]);

  const upload = useCallback(
    async (incoming: File[]) => {
      if (!apiUrl || !instanceId) return;
      for (const file of incoming) {
        const id = crypto.randomUUID();
        setUploads((prev) => [...prev, { id, name: file.name, size: file.size, progress: 0 }]);
        try {
          const listing = await uploadMediaFile(apiUrl, instanceId, file, (p) =>
            setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, progress: p } : u))),
          );
          setFiles(listing.files);
          setUsedBytes(listing.used_bytes);
          setQuotaBytes(listing.quota_bytes);
          toast.success(`Uploaded ${file.name}`);
        } catch (err) {
          toast.error(`${file.name}: ${(err as Error).message}`);
        } finally {
          setUploads((prev) => prev.filter((u) => u.id !== id));
        }
      }
    },
    [apiUrl, instanceId],
  );

  const onRename = useCallback(
    async (file: MediaFile) => {
      if (!apiUrl || !instanceId) return;
      const next = window.prompt("Rename file", file.path);
      if (!next || next === file.path) return;
      try {
        const { scene_reference_warning } = await renameMediaFile(apiUrl, instanceId, file.path, next);
        if (scene_reference_warning) {
          toast.warning("Renamed. If a scene used this file, update the source — its path changed.");
        } else {
          toast.success("File renamed");
        }
        await refresh();
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [apiUrl, instanceId, refresh],
  );

  const onDelete = useCallback(
    async (file: MediaFile) => {
      if (!apiUrl || !instanceId) return;
      if (!window.confirm(`Delete ${file.path}?`)) return;
      try {
        const listing = await deleteMediaFile(apiUrl, instanceId, file.path);
        setFiles(listing.files);
        setUsedBytes(listing.used_bytes);
        setQuotaBytes(listing.quota_bytes);
        toast.success("File deleted");
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [apiUrl, instanceId],
  );

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-12 px-6 text-center">
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Files are available while your instance is running</p>
        <p className="text-xs text-muted-foreground">Start the instance to upload and manage media.</p>
      </div>
    );
  }

  const usedPercent = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) void upload(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="space-y-4">
      {/* Storage usage */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Storage</span>
          <span className="tabular-nums">
            {formatBytes(usedBytes)} / {formatBytes(quotaBytes)}
          </span>
        </div>
        <Progress value={usedPercent} className="h-2" />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 px-6 cursor-pointer transition-all",
          dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30",
        )}
      >
        <Upload className={cn("h-8 w-8 transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
        <div className="text-center">
          <p className="text-sm font-medium">Drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Uploads go to your OBS media folder</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void upload(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>

      {/* In-flight uploads */}
      {uploads.map((u) => (
        <div key={u.id} className="rounded-lg border bg-card p-3 flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-muted-foreground shrink-0 animate-spin" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{u.name}</p>
              <span className="text-xs text-muted-foreground tabular-nums">{u.progress}%</span>
            </div>
            <Progress value={u.progress} className="h-1" />
          </div>
        </div>
      ))}

      {/* File list */}
      {loading && files.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading files…</p>
      ) : files.length === 0 && uploads.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No files yet.</p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.path} className="rounded-lg border bg-card p-3 flex items-center gap-3">
              <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.path}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRename(file)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(file)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
