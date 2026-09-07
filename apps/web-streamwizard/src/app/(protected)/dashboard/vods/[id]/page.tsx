import { getVideo } from "@/actions/twitch/vods";
import { VodDetailClient } from "@/components/vods/vod-detail-client";
import { Button } from "@repo/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = await getVideo(id);
  return {
    title: video ? `${video.title} - VOD` : "VOD Not Found",
    description: video?.description || "View VOD details",
  };
}

export default async function VodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = await getVideo(id);

  if (!video) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">VOD Not Found</h1>
          <p className="text-muted-foreground">The video you&apos;re looking for doesn&apos;t exist or has been deleted.</p>
          <Button asChild variant="outline">
            <Link href="/dashboard/vods">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to VODs
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <VodDetailClient video={video} />
    </div>
  );
}
