"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import type { ObsNode, ObsNodeInstanceOwner } from "@repo/supabase/queries/obs-nodes";
import { listNodeInstancesAction } from "@/actions/nodes";
import { useNodeMetricsStream, type ConnectionStatus } from "@/hooks/use-node-metrics-stream";
import { toggleInstanceAdmin, removeInstance } from "@/lib/instance-actions";
import { createInstanceAction } from "@/actions/nodes";
import { HostMetricsCharts } from "@/components/admin/metrics-charts";
import { formatMb } from "@/lib/format";

const INSTANCES_POLL_INTERVAL_MS = 5000;

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

function UsageBar({ label, used, total, suffix = "MB" }: { label: string; used: number; total: number; suffix?: string }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {used.toLocaleString()} / {total.toLocaleString()} {suffix}
        </span>
      </div>
      <Progress value={pct} />
    </div>
  );
}

export function NodeDetailClient({ node }: { node: ObsNode }) {
  const { status, latest, buffer } = useNodeMetricsStream(node.id, node.status, node.api_url);
  const [instances, setInstances] = useState<ObsNodeInstanceOwner[]>([]);
  const [pendingInstanceId, setPendingInstanceId] = useState<string | null>(null);
  const [removingInstanceId, setRemovingInstanceId] = useState<string | null>(null);
  const [isCreatingTestInstance, setIsCreatingTestInstance] = useState(false);

  useEffect(() => {
    if (node.status !== "linked") return;

    let cancelled = false;
    const poll = async () => {
      const { data } = await listNodeInstancesAction(node.id);
      if (!cancelled && data) setInstances(data);
    };

    poll();
    const interval = setInterval(poll, INSTANCES_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [node.id, node.status]);

  const handleToggleInstance = async (instance: ObsNodeInstanceOwner, action: "start" | "stop") => {
    if (!node.api_url) {
      toast.error("This node has no API URL set.");
      return;
    }
    setPendingInstanceId(instance.id);
    try {
      const updated = await toggleInstanceAdmin(node.api_url, instance.id, action);
      setInstances((prev) => prev.map((i) => (i.id === instance.id ? { ...i, status: updated.status } : i)));
      toast.success(`Container ${action === "start" ? "started" : "stopped"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Couldn't reach "${instance.container_name}"'s node API.`);
    } finally {
      setPendingInstanceId(null);
    }
  };

  const handleRemoveInstance = async (instance: ObsNodeInstanceOwner) => {
    if (!node.api_url) {
      toast.error("This node has no API URL set.");
      return;
    }
    if (!confirm(`Remove instance "${instance.container_name}"? This will stop and delete the container.`)) return;
    setRemovingInstanceId(instance.id);
    try {
      await removeInstance(node.api_url, instance.id);
      setInstances((prev) => prev.filter((i) => i.id !== instance.id));
      toast.success("Instance removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the instance.");
    } finally {
      setRemovingInstanceId(null);
    }
  };

  const handleCreateTestInstance = async () => {
    if (!node.api_url) {
      toast.error("This node has no API URL set.");
      return;
    }
    setIsCreatingTestInstance(true);
    try {
      const { error } = await createInstanceAction(node.id);
      if (error) throw new Error(error);
      toast.success(`Test instance created on "${node.name}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create a test instance.");
    } finally {
      setIsCreatingTestInstance(false);
    }
  };

  // Opens the admin VNC viewer page in its own window rather than embedding
  // it inline -- noVNC wants the full viewport.
  const openVnc = (instance: ObsNodeInstanceOwner) => {
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
          <CardTitle>Node</CardTitle>
          <CardDescription>
            Capacity you configured, plus hardware self-reported by the node when it linked to the panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="text-muted-foreground">Max instances</TableCell>
                <TableCell className="font-medium">{node.max_instances}</TableCell>
                <TableCell className="text-muted-foreground">Hostname</TableCell>
                <TableCell className="font-medium">{node.hostname ?? "Not linked yet"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">GPU model</TableCell>
                <TableCell className="font-medium">{node.gpu_model ?? "Not linked yet"}</TableCell>
                <TableCell className="text-muted-foreground">GPU bus ID</TableCell>
                <TableCell className="font-medium">{node.gpu_bus_id ?? "Not linked yet"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Total VRAM</TableCell>
                <TableCell className="font-medium">{formatMb(node.total_vram_mb, "Not linked yet")}</TableCell>
                <TableCell className="text-muted-foreground">RAM total</TableCell>
                <TableCell className="font-medium">{formatMb(node.ram_total_mb, "Not linked yet")}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">CPU cores</TableCell>
                <TableCell className="font-medium">{node.cpu_cores ?? "Not linked yet"}</TableCell>
                <TableCell className="text-muted-foreground">Storage total</TableCell>
                <TableCell className="font-medium">{formatMb(node.storage_total_mb, "Not linked yet")}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Live metrics</CardTitle>
            <Badge variant={variant}>{text}</Badge>
          </div>
          <Button size="sm" variant="outline" disabled={node.status !== "linked" || isCreatingTestInstance} onClick={handleCreateTestInstance}>
            {isCreatingTestInstance ? "Creating…" : "Create test instance"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {node.status !== "linked" ? (
            <p className="text-sm text-muted-foreground">Metrics are available once this node is linked.</p>
          ) : status !== "live" || !latest ? (
            <p className="text-sm text-muted-foreground">
              {status === "connecting"
                ? "Connecting to the node's metrics stream…"
                : "Couldn't reach this node's metrics stream. Check that obs-instance-manager is running and reachable at its API URL."}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">{latest.host.gpu_name}</p>
                  <UsageBar label="VRAM" used={latest.host.vram_used_mb} total={latest.host.vram_total_mb} />
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>GPU util: {latest.host.gpu_util_pct}%</span>
                    <span>GPU temp: {latest.host.gpu_temp_c}°C</span>
                    <span>Mem ctrl: {latest.host.mem_controller_util_pct}%</span>
                    <span>NVENC fps: {latest.host.nvenc_avg_fps}</span>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">Host</p>
                  <UsageBar label="RAM" used={latest.host.ram_used_mb} total={latest.host.ram_total_mb} />
                  <p className="text-xs text-muted-foreground">CPU: {latest.host.cpu_pct.toFixed(1)}%</p>
                </div>
              </div>
              <HostMetricsCharts samples={buffer} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instances</CardTitle>
          <CardDescription>Containers provisioned on this node.</CardDescription>
        </CardHeader>
        <CardContent>
          {instances.length === 0 ? (
            <p className="text-sm text-muted-foreground">No instances on this node.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>RAM</TableHead>
                  <TableHead>VRAM</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((instance) => {
                  const containerMetrics = latest?.containers[instance.id];
                  const isPending = pendingInstanceId === instance.id;
                  const isRunning = instance.status === "running";
                  const canToggle = instance.status === "running" || instance.status === "stopped" || instance.status === "error";
                  return (
                    <TableRow key={instance.id}>
                      <TableCell>
                        <Link href={`/obs/${node.id}/instances/${instance.id}`} className="hover:underline">
                          {instance.owner_name ?? instance.owner_email ?? instance.user_id}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{instance.container_name}</TableCell>
                      <TableCell>
                        <Badge variant={instanceStatusVariant(instance.status)}>{instance.status}</Badge>
                      </TableCell>
                      <TableCell>{containerMetrics ? `${containerMetrics.cpu_pct.toFixed(1)}%` : "—"}</TableCell>
                      <TableCell>
                        {containerMetrics ? `${containerMetrics.ram_used_mb} / ${containerMetrics.ram_limit_mb} MB` : "—"}
                      </TableCell>
                      <TableCell>{containerMetrics ? `${containerMetrics.vram_used_mb} MB` : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" disabled={!isRunning || !node.api_url} onClick={() => openVnc(instance)}>
                          VNC
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2"
                          disabled={!canToggle || isPending}
                          onClick={() => handleToggleInstance(instance, isRunning ? "stop" : "start")}
                        >
                          {isPending ? "Working…" : isRunning ? "Stop" : "Start"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="ml-2"
                          disabled={removingInstanceId === instance.id}
                          onClick={() => handleRemoveInstance(instance)}
                        >
                          {removingInstanceId === instance.id ? "Removing…" : "Remove"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
