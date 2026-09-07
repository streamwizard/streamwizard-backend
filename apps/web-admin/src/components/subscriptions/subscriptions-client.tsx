"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { revokeSubscriptionAction } from "@/actions/subscriptions";

import { GrantDialog, EditDialog } from "./subscription-dialogs";
import type { ProductWithPlans, SubscriptionRow, UserRow } from "./types";

export type { ProductWithPlans, SubscriptionRow, UserRow } from "./types";

interface Props {
  users: UserRow[];
  subscriptions: SubscriptionRow[];
  products: ProductWithPlans[];
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "active") return "default";
  if (status === "trialing") return "secondary";
  if (status === "past_due") return "destructive";
  return "outline";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function SubscriptionsClient({ users, subscriptions: initialSubs, products }: Props) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>(initialSubs);
  const [search, setSearch] = useState("");

  const subsByUser = useMemo(() => {
    const map = new Map<string, SubscriptionRow[]>();
    for (const sub of subscriptions) {
      const list = map.get(sub.user_id) ?? [];
      list.push(sub);
      map.set(sub.user_id, list);
    }
    return map;
  }, [subscriptions]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleGranted = (userId: string, sub: SubscriptionRow) => {
    setSubscriptions((prev) => {
      // Replace any existing sub for the same product (we canceled it server-side)
      const filtered = prev.filter(
        (s) => !(s.user_id === userId && s.plan.product.id === sub.plan.product.id)
      );
      return [...filtered, sub];
    });
  };

  const handleRevoke = (subscriptionId: string) => {
    setSubscriptions((prev) => prev.filter((s) => s.id !== subscriptionId));
  };

  const handleUpdated = (subscriptionId: string, updates: Partial<SubscriptionRow>) => {
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === subscriptionId ? { ...s, ...updates } : s))
    );
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Active subscriptions</TableHead>
              <TableHead className="w-[140px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {filteredUsers.map((user) => {
              const userSubs = subsByUser.get(user.id) ?? [];
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {userSubs.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No subscriptions</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {userSubs.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center gap-1 rounded-md border px-2 py-1"
                          >
                            <div className="flex flex-col leading-tight mr-1">
                              <span className="text-xs font-medium">
                                {sub.plan.product.name} — {sub.plan.name}
                              </span>
                              {sub.current_period_end && (
                                <span className="text-xs text-muted-foreground">
                                  until {new Date(sub.current_period_end).toLocaleDateString()}
                                </span>
                              )}
                              {sub.grant_note && (
                                <span className="text-xs text-muted-foreground italic">
                                  {sub.grant_note}
                                </span>
                              )}
                            </div>
                            <Badge variant={statusVariant(sub.status)} className="text-xs h-5">
                              {sub.status.replace("_", " ")}
                            </Badge>
                            <EditDialog
                              subscription={sub}
                              onUpdated={(updates) => handleUpdated(sub.id, updates)}
                            />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7">
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Revoke access?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will cancel {user.name}&apos;s{" "}
                                    <strong>
                                      {sub.plan.product.name} — {sub.plan.name}
                                    </strong>{" "}
                                    subscription immediately. They will lose access on next page load.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={async () => {
                                      const result = await revokeSubscriptionAction(sub.id);
                                      if (result.error) {
                                        toast.error(result.error);
                                        return;
                                      }
                                      toast.success("Access revoked.");
                                      handleRevoke(sub.id);
                                    }}
                                  >
                                    Revoke
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <GrantDialog
                      user={user}
                      products={products}
                      onGranted={(sub) => handleGranted(user.id, sub)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
