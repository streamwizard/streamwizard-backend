import { getPendingLibraryEntries } from "@/actions/widget-library";
import { AdminWidgetLibraryClient } from "@/components/widget-library/admin-widget-library-client";

export const dynamic = "force-dynamic";

export default async function AdminWidgetLibraryPage() {
  const { data: entriesRaw, error } = await getPendingLibraryEntries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Widget Moderation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve community widget submissions.
        </p>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <AdminWidgetLibraryClient entries={(entriesRaw ?? []) as any} error={error} />
    </div>
  );
}
