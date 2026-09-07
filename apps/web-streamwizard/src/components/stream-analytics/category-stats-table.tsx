import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import type { CategorySegmentStats } from "@/lib/analytics/category-segments";
import { formatDuration } from "@/lib/format";

interface CategoryStatsTableProps {
  segments: CategorySegmentStats[];
}

export function CategoryStatsTable({ segments }: CategoryStatsTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Stats by category</CardTitle>
      </CardHeader>
      <CardContent>
        {segments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No categories yet. Stream for a minute in something and we&apos;ll break it down here.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Avg viewers</TableHead>
                <TableHead>Peak viewers</TableHead>
                <TableHead>Follows</TableHead>
                <TableHead>Subs</TableHead>
                <TableHead>Bits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segments.map((segment, i) => (
                <TableRow key={`${segment.gameId ?? "unknown"}-${segment.startSeconds}-${i}`}>
                  <TableCell className="font-medium">{segment.gameName ?? "Unknown"}</TableCell>
                  <TableCell>{formatDuration(segment.durationSeconds)}</TableCell>
                  <TableCell>{segment.avgViewers.toLocaleString()}</TableCell>
                  <TableCell>{segment.peakViewers.toLocaleString()}</TableCell>
                  <TableCell>{segment.follows.toLocaleString()}</TableCell>
                  <TableCell>{segment.subs.toLocaleString()}</TableCell>
                  <TableCell>{segment.bits.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
