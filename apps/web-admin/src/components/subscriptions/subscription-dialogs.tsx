"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui";
import { Pencil, Plus } from "lucide-react";
import { grantSubscriptionAction, updateSubscriptionAction } from "@/actions/subscriptions";
import type { ProductWithPlans, SubscriptionRow, UserRow } from "./types";

/** Grant a product to a user, and edit an existing grant. Both are admin-only
 *  writes that bypass Stripe entirely. */

export function GrantDialog({
  user,
  products,
  onGranted,
}: {
  user: UserRow;
  products: ProductWithPlans[];
  onGranted: (sub: SubscriptionRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState<"active" | "trialing">("active");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedProduct = products.find((p) => p.id === productId);
  const plans = selectedProduct?.plans ?? [];

  const handleProductChange = (val: string) => {
    setProductId(val);
    setPlanId("");
  };

  const handleSubmit = () => {
    if (!planId) {
      toast.error("Select a plan first.");
      return;
    }
    startTransition(async () => {
      const result = await grantSubscriptionAction(
        user.id,
        planId,
        status,
        expiresAt || null,
        note || null
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Access granted to ${user.name}`);
      const product = products.find((p) => p.id === productId)!;
      const plan = product.plans.find((p) => p.id === planId)!;
      onGranted({
        id: crypto.randomUUID(),
        user_id: user.id,
        status,
        current_period_end: expiresAt || null,
        grant_note: note || null,
        plan: { id: plan.id, name: plan.name, product: { id: product.id, name: product.name } },
      });
      setOpen(false);
      setPlanId("");
      setNote("");
      setExpiresAt("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Grant access
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Grant access — {user.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={productId} onValueChange={handleProductChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId} disabled={plans.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "active" | "trialing")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Expiry date <span className="text-muted-foreground text-xs">(leave empty for permanent)</span></Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              placeholder="e.g. 1 month trial, permanent beta access"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !planId}>
            {isPending ? "Granting…" : "Grant access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditDialog({
  subscription,
  onUpdated,
}: {
  subscription: SubscriptionRow;
  onUpdated: (updated: Partial<SubscriptionRow>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"active" | "trialing" | "past_due">(
    subscription.status as "active" | "trialing" | "past_due"
  );
  const [expiresAt, setExpiresAt] = useState(
    subscription.current_period_end
      ? subscription.current_period_end.slice(0, 10)
      : ""
  );
  const [note, setNote] = useState(subscription.grant_note ?? "");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await updateSubscriptionAction(subscription.id, {
        status,
        expiresAt: expiresAt || null,
        note: note || null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Subscription updated.");
      onUpdated({ status, current_period_end: expiresAt || null, grant_note: note || null });
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>
            Edit — {subscription.plan.product.name} / {subscription.plan.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "active" | "trialing" | "past_due")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="past_due">Past due</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Expiry date <span className="text-muted-foreground text-xs">(leave empty for permanent)</span></Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              placeholder="e.g. 1 month trial"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
