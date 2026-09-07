"use client";

import { useState } from "react";
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
import type { IngestNode, IngestNodeCapacity } from "@repo/supabase/queries/ingest-nodes";
import { createIngestNodeAction, deleteIngestNodeAction, updateIngestNodeAction } from "@/actions/ingest-nodes";
import { ingestNodeCapacitySchema } from "@/schemas/ingest-node";
import { formatMb } from "@/lib/format";
import { copyToClipboard, nodeStatusVariant } from "@/lib/node-ui";

const EMPTY_FORM: IngestNodeCapacity = {
  name: "",
  max_concurrent_sessions: null,
  public_hostname: null,
};

/** Compact summary of what install.sh self-reported at claim time. No health
 * column here (unlike OBS nodes) -- ingest-control never publishes its HTTP
 * port, so there's nothing for the admin's browser to reach and poll. */
function HardwareSummary({ node }: { node: IngestNode }) {
  if (node.status !== "linked") {
    return <span className="text-xs text-muted-foreground">Not linked yet</span>;
  }
  return (
    <div className="text-xs">
      <p className="font-medium">
        {formatMb(node.ram_total_mb)} RAM · {node.cpu_cores ?? "—"} cores
      </p>
      <p className="text-muted-foreground">
        {node.public_ip ?? "no public IP"} · lan {node.lan_ip ?? "—"} · tailscale {node.tailscale_ip ?? "—"}
      </p>
    </div>
  );
}

function IngestNodeForm({
  form,
  setForm,
}: {
  form: IngestNodeCapacity;
  setForm: (form: IngestNodeCapacity) => void;
}) {
  const nameResult = ingestNodeCapacitySchema.shape.name.safeParse(form.name);
  const nameError = !nameResult.success && form.name.length > 0 ? nameResult.error.issues[0]?.message : null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 space-y-2">
        <Label htmlFor="ingest-node-name">Name (this becomes the node&apos;s hostname)</Label>
        <Input
          id="ingest-node-name"
          placeholder="ingest-box-1"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>
      <div className="col-span-2 space-y-2">
        <Label htmlFor="ingest-node-max-sessions">Max concurrent sessions (optional)</Label>
        <Input
          id="ingest-node-max-sessions"
          type="number"
          value={form.max_concurrent_sessions ?? ""}
          onChange={(e) =>
            setForm({ ...form, max_concurrent_sessions: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
      </div>
      <div className="col-span-2 space-y-2">
        <Label htmlFor="ingest-node-public-hostname">Public domain (optional)</Label>
        <Input
          id="ingest-node-public-hostname"
          placeholder="ingest-01.streamwizard.org"
          value={form.public_hostname ?? ""}
          onChange={(e) => setForm({ ...form, public_hostname: e.target.value === "" ? null : e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Point a DNS record at this box, then set it here. Encoders connect to this domain
          instead of the raw IP — leave blank to use the public IP.
        </p>
      </div>
    </div>
  );
}

export function IngestNodesSection({
  initialNodes,
  error,
}: {
  initialNodes: IngestNode[];
  error: string | null;
}) {
  const [nodes, setNodes] = useState<IngestNode[]>(initialNodes);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<IngestNodeCapacity>(EMPTY_FORM);
  const [isPending, setIsPending] = useState(false);
  const [installCommand, setInstallCommand] = useState<string | null>(null);

  const [editingNode, setEditingNode] = useState<IngestNode | null>(null);
  const [editForm, setEditForm] = useState<IngestNodeCapacity>(EMPTY_FORM);

  const [deletingNode, setDeletingNode] = useState<IngestNode | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  const handleCreate = async () => {
    setIsPending(true);
    const { data, error } = await createIngestNodeAction(createForm);
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

  const openEdit = (node: IngestNode) => {
    setEditingNode(node);
    setEditForm({
      name: node.name,
      max_concurrent_sessions: node.max_concurrent_sessions,
      public_hostname: node.public_hostname,
    });
  };

  const handleEdit = async () => {
    if (!editingNode) return;
    setIsPending(true);
    const { data, error } = await updateIngestNodeAction(editingNode.id, editForm);
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
    const { error } = await deleteIngestNodeAction(id);
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
              This is the only time the claim token will be shown. The node joins Tailscale
              automatically during install — no auth key needs to be pasted in.
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
            <CardTitle>Ingest Nodes</CardTitle>
            <CardDescription>SRT/SRTLA boxes running ingest-server.</CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setCreateForm(EMPTY_FORM)}>Add node</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add ingest node</DialogTitle>
                <DialogDescription>
                  Name it and optionally cap how many concurrent sessions it should handle.
                  Hardware details (RAM, CPU, storage, public IP, Tailscale IP, hostname) are
                  self-reported by the node when you run the one-time install command you&apos;ll
                  get after saving.
                </DialogDescription>
              </DialogHeader>
              <IngestNodeForm form={createForm} setForm={setCreateForm} />
              <DialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={isPending || !ingestNodeCapacitySchema.safeParse(createForm).success}
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
                <TableHead>Link status</TableHead>
                <TableHead>Max concurrent sessions</TableHead>
                <TableHead>Hardware</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.map((node) => (
                <TableRow key={node.id}>
                  <TableCell className="font-medium">
                    {node.name}
                    {node.public_hostname && (
                      <p className="text-xs font-normal text-muted-foreground">{node.public_hostname}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={nodeStatusVariant(node.status)}>{node.status}</Badge>
                  </TableCell>
                  <TableCell>{node.max_concurrent_sessions ?? "Unlimited"}</TableCell>
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
                            &quot;{node.name}&quot; will be removed. Any sessions already running on
                            it aren&apos;t cleaned up by this action — this can&apos;t be undone.
                            Type <span className="font-mono font-semibold">{node.name}</span> to
                            confirm.
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingNode} onOpenChange={(open) => !open && setEditingNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit ingest node</DialogTitle>
            <DialogDescription>Update this node&apos;s capacity settings.</DialogDescription>
          </DialogHeader>
          <IngestNodeForm form={editForm} setForm={setEditForm} />
          <DialogFooter>
            <Button
              onClick={handleEdit}
              disabled={isPending || !ingestNodeCapacitySchema.safeParse(editForm).success}
            >
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
