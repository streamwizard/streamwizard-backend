import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@repo/supabase/next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { MonitorHeader } from "@/components/monitor-header";
import { MonitorSidebar } from "@/components/monitor-sidebar";
import { SidebarInset, SidebarProvider } from "@repo/ui";
import { RefreshIntervalProvider } from "@/lib/refresh-interval-context";
import { TimeRangeProvider } from "@/lib/time-range-context";
import { BandwidthUnitProvider } from "@/lib/bandwidth-unit-context";
import { DASHBOARD_COOKIE } from "@/lib/dashboard-prefs";
import { homeEnv } from "@/lib/home-env";

export default async function MonitorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    // A missing session is normal for a first visit, but a real error here
    // (bad/expired token, misconfigured Supabase client) is worth logging so
    // the "silent bounce to /login" has a paper trail in the server logs.
    if (error) console.warn("[web-admin] getUser failed at dashboard gate:", error.message);
    redirect("/login?error=signin_required");
  }

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) {
    redirect("/no-access");
  }

  // Restore the dashboard chrome settings persisted from a previous visit, so
  // the first render already reflects them (no post-hydration flash). The
  // providers parse these raw cookie strings client-side.
  const cookieStore = await cookies();
  const initialRange = cookieStore.get(DASHBOARD_COOKIE.timeRange)?.value;
  const initialInterval = cookieStore.get(DASHBOARD_COOKIE.refreshInterval)?.value;
  const initialUnit = cookieStore.get(DASHBOARD_COOKIE.bandwidthUnit)?.value;

  return (
    <TimeRangeProvider initialRange={initialRange}>
      <RefreshIntervalProvider initialInterval={initialInterval}>
        <BandwidthUnitProvider initialUnit={initialUnit}>
          <SidebarProvider>
            <MonitorSidebar userEmail={data.user.email ?? ""} />
            <SidebarInset>
              <MonitorHeader envLabel={homeEnv()} />
              <main className="flex-1 overflow-auto p-6">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </BandwidthUnitProvider>
      </RefreshIntervalProvider>
    </TimeRangeProvider>
  );
}
