import { redirect } from "next/navigation";
import { createClient } from "@repo/supabase/next/server";
import { signOut } from "@/lib/auth-actions";

// Where the dashboard sends people who are signed in but aren't admins. Kept
// outside the (monitor) route group so it doesn't hit the admin gate itself.
export default async function NoAccessPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // Signed-out users belong on /login, not here.
  if (!data.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">No admin access</h1>
          <p className="text-sm text-muted-foreground">StreamWizard Admin is admins only.</p>
        </div>

        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          You&apos;re signed in as{" "}
          <span className="font-medium">{data.user.email ?? "this account"}</span>, but it doesn&apos;t
          have admin access.
        </p>

        <p className="text-sm text-muted-foreground">
          Sign out and try another account, or ask an admin to add you.
        </p>

        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
