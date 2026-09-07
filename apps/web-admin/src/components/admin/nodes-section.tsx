"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import type { ObsNode, ObsNodeCapacity } from "@repo/supabase/queries/obs-nodes";
import type { NodeHealthStatus } from "@/lib/node-health";
import { createNodeAction, deleteNodeAction, updateNodeAction } from "@/actions/nodes";
import { obsNodeCapacitySchema } from "@/schemas/obs-node";
import { formatMb } from "@/lib/format";
import {
  copyToClipboard,
  nodeHealthLabel,
  nodeHealthVariant,
  nodeStatusVariant,
} from "@/lib/node-ui";

const EMPTY_FORM: ObsNodeCapacity = {
  name: "",
  max_instances: 10,
  api_url: "",
};

/** Compact, two-line summary of what install.sh self-reported at claim time. */
function HardwareSummary({ node }: { node: ObsNode }) {
  if (node.status !== "linked") {
    return <span className="text-xs text-muted-foreground">Not linked yet</span>;
  }
  return (
    <div className="text-xs">
      <p className="font-medium">
        {node.gpu_model ?? "GPU"}
        {node.total_vram_mb != null ? ` · ${formatMb(node.total_vram_mb)} VRAM` : ""}
      </p>
      <p className="text-muted-foreground">
        {formatMb(node.ram_total_mb)} RAM · {node.cpu_cores ?? "—"} cores
      </p>
    </div>
  );
}

function NodeForm({
  form,
  setForm,
}: {
  form: ObsNodeCapacity;
  setForm: (form: ObsNodeCapacity) => void;
}) {
  const nameResult = obsNodeCapacitySchema.shape.name.safeParse(form.name);
  const nameError = !nameResult.success && form.name.length > 0 ? nameResult.error.issues[0]?.message : null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 space-y-2">
        <Label htmlFor="node-name">Name (this becomes the node&apos;s hostname)</Label>
        <Input
          id="node-name"
          placeholder="gpu-box-1"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>
      <div className="col-span-2 space-y-2">
        <Label htmlFor="node-api-url">API URL</Label>
        <Input
          id="node-api-url"
          placeholder="http://10.10.10.185:3000"
          value={form.api_url}
          onChange={(e) => setForm({ ...form, api_url: e.target.value })}
        />
      </div>
      <div className="col-span-2 space-y-2">
        <Label htmlFor="node-max-instances">Max instances</Label>
        <Input
          id="node-max-instances"
          type="number"
          value={form.max_instances}
          onChange={(e) => setForm({ ...form, max_instances: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}

export function NodesSection({
  initialNodes,
  error,
  healthByNodeId,
}: {
  initialNodes: ObsNode[];
  error: string | null;
  healthByNodeId: Record<string, NodeHealthStatus>;
}) {
  const [nodes, setNodes] = useState<ObsNode[]>(initialNodes);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ObsNodeCapacity>(EMPTY_FORM);
  const [isPending, setIsPending] = useState(false);
  const [installCommand, setInstallCommand] = useState<string | null>(null);

  const [editingNode, setEditingNode] = useState<ObsNode | null>(null);
  const [editForm, setEditForm] = useState<ObsNodeCapacity>(EMPTY_FORM);

  const [deletingNode, setDeletingNode] = useState<ObsNode | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  const handleCreate = async () => {
    setIsPending(true);
    const { data, error } = await createNodeAction(createForm);
    setIsPending(false);
    if (error || !data) {
      toast.error(error ?? "Couldn't create that node. Try again.");
      return;
    }
    setNodes((prev) => [data.node, ...prev]);
    setIsCreateOpen(false);
    setCreateForm(EMPTY_FORM);
    setInstallCommand(data.installCommand);
  };

  const openEdit = (node: ObsNode) => {
    setEditingNode(node);
    setEditForm({
      name: node.name,
      max_instances: node.max_instances,
      api_url: node.api_url ?? "",
    });
  };

  const handleEdit = async () => {
    if (!editingNode) return;
    setIsPending(true);
    const { data, error } = await updateNodeAction(editingNode.id, editForm);
    setIsPending(false);
    if (error || !data) {
      toast.error(error ?? "Couldn't update that node. Try again.");
      return;
    }
    setNodes((prev) => prev.map((n) => (n.id === data.id ? data : n)));
    setEditingNode(null);
    toast.success("Node updated.");
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteNodeAction(id);
    if (error) {
      toast.error(error);
      return;
    }
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setDeletingNode(null);
    setDeleteConfirmText("");
    toast.success("Node deleted.");
  };

  return (
    <>
      {installCommand && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle>Install command — copy this now</CardTitle>
            <CardDescription>
              This is the only time the claim token will be shown. Run this on the node to link it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-all">
                {installCommand}
              </pre>
              <Button size="icon" variant="ghost" onClick={() => copyToClipboard(installCommand, "Install command")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" className="mt-3" onClick={() => setInstallCommand(null)}>
              I&apos;ve saved it
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Nodes</CardTitle>
            <CardDescription>GPU hosts running obs-instance-manager.</CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setCreateForm(EMPTY_FORM)}>Add node</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add node</DialogTitle>
                <DialogDescription>
                  Name it, tell it how to reach the node, and cap how many instances it can run.
                  Hardware details (GPU, VRAM, RAM, CPU, storage, hostname) are self-reported by
                  the node when you run the one-time install command you&apos;ll get after saving.
                </DialogDescription>
              </DialogHeader>
              <NodeForm form={createForm} setForm={setCreateForm} />
              <DialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={isPending || !obsNodeCapacitySchema.safeParse(createForm).success}
                >
                  {isPending ? "Creating…" : "Create node"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>API URL</TableHead>
                <TableHead>Link status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Max instances</TableHead>
                <TableHead>Hardware</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.map((node) => {
                const health = healthByNodeId[node.id] ?? "unreachable";
                return (
                  <TableRow key={node.id}>
                    <TableCell className="font-medium">
                      <Link href={`/obs/${node.id}`} className="hover:underline">
                        {node.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{node.api_url ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={nodeStatusVariant(node.status)}>{node.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={nodeHealthVariant(health)}>{nodeHealthLabel(health)}</Badge>
                    </TableCell>
                    <TableCell>{node.max_instances}</TableCell>
                    <TableCell>
                      <HardwareSummary node={node} />
                    </TableCell>
                    <TableCell>{new Date(node.created_at).toLocaleString("en-US")}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(node)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog
                        open={deletingNode?.id === node.id}
                        onOpenChange={(open) => {
                          if (!open) {
                            setDeletingNode(null);
                            setDeleteConfirmText("");
                          }
                        }}
                      >
                        <Button size="icon" variant="ghost" onClick={() => setDeletingNode(node)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this node?</AlertDialogTitle>
                            <AlertDialogDescription>
                              &quot;{node.name}&quot; will be removed. Any instances already running on it
                              aren&apos;t cleaned up by this action — this can&apos;t be undone. Type{" "}
                              <span className="font-mono font-semibold">{node.name}</span> to confirm.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <Input
                            autoFocus
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder={node.name}
                          />
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep it</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={deleteConfirmText !== node.name}
                              onClick={() => handleDelete(node.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingNode} onOpenChange={(open) => !open && setEditingNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit node</DialogTitle>
            <DialogDescription>Update this node&apos;s capacity settings.</DialogDescription>
          </DialogHeader>
          <NodeForm form={editForm} setForm={setEditForm} />
          <DialogFooter>
            <Button
              onClick={handleEdit}
              disabled={isPending || !obsNodeCapacitySchema.safeParse(editForm).success}
            >
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
