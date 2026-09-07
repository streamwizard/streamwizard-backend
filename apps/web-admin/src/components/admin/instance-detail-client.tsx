"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import type { ObsNode, ObsNodeInstanceDetail } from "@repo/supabase/queries/obs-nodes";
import { useNodeMetricsStream, type ConnectionStatus } from "@/hooks/use-node-metrics-stream";
import { toggleInstanceAdmin } from "@/lib/instance-actions";
import { formatMb } from "@/lib/format";
import { ContainerMetricsCharts } from "@/components/admin/metrics-charts";

function statusLabel(status: ConnectionStatus): { text: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  switch (status) {
    case "live":
      return { text: "Live", variant: "default" };
    case "connecting":
      return { text: "Connecting…", variant: "secondary" };
    case "unreachable":
      return { text: "Unreachable", variant: "destructive" };
    default:
      return { text: "Not linked", variant: "outline" };
  }
}

function instanceStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "running") return "default";
  if (status === "creating") return "secondary";
  if (status === "error") return "destructive";
  return "outline";
}

export function InstanceDetailClient({ node, instance }: { node: ObsNode; instance: ObsNodeInstanceDetail }) {
  const { status, latest, buffer } = useNodeMetricsStream(node.id, node.status, node.api_url);
  const [currentStatus, setCurrentStatus] = useState(instance.status);
  const [isPending, setIsPending] = useState(false);

  const containerMetrics = latest?.containers[instance.id];
  const isRunning = currentStatus === "running";
  const canToggle = currentStatus === "running" || currentStatus === "stopped" || currentStatus === "error";

  const handleToggle = async () => {
    if (!node.api_url) {
      toast.error("This node has no API URL set.");
      return;
    }
    setIsPending(true);
    try {
      const updated = await toggleInstanceAdmin(node.api_url, instance.id, isRunning ? "stop" : "start");
      setCurrentStatus(updated.status);
      toast.success(`Container ${isRunning ? "stopped" : "started"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Couldn't reach "${instance.container_name}"'s node API.`);
    } finally {
      setIsPending(false);
    }
  };

  const openVnc = () => {
    if (!node.api_url) return;
    const params = new URLSearchParams({
      nodeId: node.id,
      instanceId: instance.id,
      name: instance.container_name,
    });
    window.open(`/vnc?${params.toString()}`, `vnc-${instance.id}`, "width=1280,height=800");
  };

  const { text, variant } = statusLabel(status);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Instance details</CardTitle>
          <CardDescription>Configuration and ownership for this container.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={instanceStatusVariant(currentStatus)}>{currentStatus}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Resolution</p>
            <p className="font-medium">{instance.resolution}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">VRAM allocated</p>
            <p className="font-medium">{instance.vram_allocated_mb} MB</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="font-medium">{new Date(instance.created_at).toLocaleString("en-US")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Owner</p>
            <p className="font-medium">{instance.owner_name ?? instance.owner_email ?? instance.user_id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Container ID</p>
            <p className="font-mono text-xs">{instance.container_id ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">RAM limit</p>
            <p className="font-medium">{formatMb(instance.memory_mb)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CPU quota</p>
            <p className="font-medium">{instance.cpu_quota}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Shared memory</p>
            <p className="font-medium">{instance.shm_size}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Config template</p>
            <p className="font-medium">{instance.config_template ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Storage</p>
            <p className="font-medium">
              {instance.used_storage_bytes != null ? formatMb(Math.round(instance.used_storage_bytes / (1024 * 1024))) : "—"}
              {" / "}
              {formatMb(instance.storage_quota_mb)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Live metrics</CardTitle>
            <Badge variant={variant}>{text}</Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!isRunning || !node.api_url} onClick={openVnc}>
              VNC
            </Button>
            <Button size="sm" variant="outline" disabled={!canToggle || isPending || !node.api_url} onClick={handleToggle}>
              {isPending ? "Working…" : isRunning ? "Stop" : "Start"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {node.status !== "linked" ? (
            <p className="text-sm text-muted-foreground">Metrics are available once this instance&apos;s node is linked.</p>
          ) : status !== "live" || !containerMetrics ? (
            <p className="text-sm text-muted-foreground">
              {status === "connecting"
                ? "Connecting to the node's metrics stream…"
                : status === "live"
                  ? "This instance isn't reporting metrics yet — it may not be running."
                  : "Couldn't reach this node's metrics stream."}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">CPU</p>
                  <p className="font-medium">{containerMetrics.cpu_pct.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">RAM</p>
                  <p className="font-medium">
                    {containerMetrics.ram_used_mb} / {containerMetrics.ram_limit_mb} MB
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">VRAM</p>
                  <p className="font-medium">{containerMetrics.vram_used_mb} MB</p>
                </div>
              </div>
              <ContainerMetricsCharts samples={buffer} instanceId={instance.id} vramMaxMb={instance.vram_allocated_mb} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
