export function ChartEmptyState({ height = 240, message = "No data in this range" }: { height?: number; message?: string }) {
  return (
    <div style={{ height }} className="flex items-center justify-center rounded-md border border-dashed">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
