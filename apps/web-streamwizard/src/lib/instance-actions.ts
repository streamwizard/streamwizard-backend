import { supabase } from "@repo/supabase/next/client";

// Calls obs-instance-manager's user-scoped POST /instances/:id/start|stop.
// Used by the end-user pages (deck, cloud OBS dashboard) where the caller
// owns the instance.
export async function toggleInstance(apiUrl: string, instanceId: string, action: "start" | "stop"): Promise<{ status: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/instances/${instanceId}/${action}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to ${action} container (${res.status})`);
  }

  return (await res.json()) as { status: string };
}
