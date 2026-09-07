"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Music, Video, FileJson, Trash2, Loader2, Copy, ImageIcon } from "lucide-react";
import { Button, Progress } from "@repo/ui";
import { cn } from "@repo/ui";
import { toast } from "sonner";
import {
  confirmAssetUpload,
  createAssetUpload,
  deleteAsset,
  type AssetKind,
  type AssetListing,
  type UserAsset,
} from "@/actions/assets";
import { formatBytes } from "@/lib/format";

interface Uploading {
  id: string;
  name: string;
  progress: number;
}

// Browser PUTs straight to the presigned R2 URL; XHR gives real progress.
function putToPresignedUrl(url: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.send(file);
  });
}

function KindIcon({ asset }: { asset: UserAsset }) {
  if (asset.kind === "image") {
    return (
      // Plain <img>: R2 CDN thumbnails don't need next/image optimization here
      // eslint-disable-next-line @next/next/no-img-element
      <img src={asset.url} alt={asset.file_name} className="h-10 w-10 rounded object-cover bg-muted" />
    );
  }
  const Icon = asset.kind === "audio" ? Music : asset.kind === "video" ? Video : FileJson;
  return (
    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
      <Icon className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

interface MediaLibraryProps {
  initialListing: AssetListing | null;
  // Select mode (asset pickers): clicking a file calls onSelect instead of
  // showing copy/delete actions. kindFilter narrows the list (e.g. images only).
  onSelect?: (asset: UserAsset) => void;
  kindFilter?: AssetKind[];
}

export function MediaLibrary({ initialListing, onSelect, kindFilter }: MediaLibraryProps) {
  const [listing, setListing] = useState<AssetListing | null>(initialListing);
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (incoming: File[]) => {
    for (const file of incoming) {
      const id = crypto.randomUUID();
      setUploads((prev) => [...prev, { id, name: file.name, progress: 0 }]);
      try {
        const { data, error } = await createAssetUpload({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        });
        if (error || !data) throw new Error(error ?? "Failed to start the upload.");

        await putToPresignedUrl(data.uploadUrl, file, (p) =>
          setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, progress: p } : u))),
        );

        const confirmed = await confirmAssetUpload(data.assetId);
        if (confirmed.error || !confirmed.data) throw new Error(confirmed.error ?? "Failed to finish the upload.");
        setListing(confirmed.data);
        toast.success(`Uploaded ${file.name}`);
      } catch (err) {
        toast.error(`${file.name}: ${(err as Error).message}`);
      } finally {
        setUploads((prev) => prev.filter((u) => u.id !== id));
      }
    }
  }, []);

  const onDelete = useCallback(async (asset: UserAsset) => {
    if (!window.confirm(`Delete ${asset.file_name}? Overlays using it will lose it.`)) return;
    const { data, error } = await deleteAsset(asset.id);
    if (error) {
      toast.error(error);
      return;
    }
    if (data) setListing(data);
    toast.success("File deleted");
  }, []);

  const onCopyUrl = useCallback(async (asset: UserAsset) => {
    await navigator.clipboard.writeText(asset.url);
    toast.success("URL copied");
  }, []);

  const usedPercent =
    listing && listing.quota_bytes > 0 ? Math.min(100, (listing.used_bytes / listing.quota_bytes) * 100) : 0;

  const visibleFiles = (listing?.files ?? []).filter((f) => !kindFilter || kindFilter.includes(f.kind));

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) void upload(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="space-y-4">
      {listing && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Storage</span>
            <span className="tabular-nums">
              {formatBytes(listing.used_bytes)} / {formatBytes(listing.quota_bytes)}
            </span>
          </div>
          <Progress value={usedPercent} className="h-2" />
        </div>
      )}

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
          <p className="text-xs text-muted-foreground mt-1">
            Images, sounds, and videos for your overlays. Up to 100MB per file.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,audio/*,video/*,.json"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void upload(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>

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

      {!listing || (visibleFiles.length === 0 && uploads.length === 0) ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nothing here yet</p>
          <p className="text-xs text-muted-foreground">
            Upload alert images, sounds, or videos and use them in any overlay.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleFiles.map((asset) => (
            <div
              key={asset.id}
              onClick={onSelect ? () => onSelect(asset) : undefined}
              className={cn(
                "rounded-lg border bg-card p-3 flex items-center gap-3",
                onSelect && "cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors",
              )}
            >
              <KindIcon asset={asset} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{asset.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(asset.size_bytes)} · {asset.kind}
                </p>
              </div>
              {!onSelect && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Copy URL" onClick={() => onCopyUrl(asset)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Delete" onClick={() => onDelete(asset)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
