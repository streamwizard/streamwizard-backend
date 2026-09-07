import { NextRequest, NextResponse } from "next/server";
import { GetClipDownloadURL } from "@/actions/twitch/clips";
import { createClient } from "@repo/supabase/next/server";
import { reportError } from "@repo/sentry";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Get request body
    const body = await request.json();
    const { clipId, layout } = body;

    if (!clipId || !layout) {
      return NextResponse.json(
        { error: "Missing clipId or layout" },
        { status: 400 }
      );
    }

    // Get the download URL
    const urlResult = await GetClipDownloadURL(clipId, user.id);
    if (!urlResult.success || !urlResult.data) {
      return NextResponse.json(
        { error: urlResult.message },
        { status: 400 }
      );
    }

    const downloadUrl = layout === "landscape" 
      ? urlResult.data.data[0].landscape_download_url 
      : urlResult.data.data[0].portrait_download_url;

    if (!downloadUrl) {
      return NextResponse.json(
        { error: `No ${layout} download URL available` },
        { status: 404 }
      );
    }

    // Stream video from Twitch CDN (supports range-based streaming)
    const forwardHeaders: Record<string, string> = {};
    const range = request.headers.get("range");
    if (range) {
      forwardHeaders["Range"] = range;
    }

    const videoResponse = await fetch(downloadUrl, {
      headers: forwardHeaders,
    });
    
    if (!videoResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch video from Twitch" },
        { status: videoResponse.status }
      );
    }

    const responseHeaders: Record<string, string> = {
      "Content-Type": videoResponse.headers.get("content-type") ?? "video/mp4",
      "Accept-Ranges": "bytes",
      "Content-Disposition": `attachment; filename="clip-${layout}.mp4"`,
    };

    const contentLength = videoResponse.headers.get("content-length");
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    const contentRange = videoResponse.headers.get("content-range");
    if (contentRange) responseHeaders["Content-Range"] = contentRange;

    // Return a streamed response instead of buffering the whole file first.
    return new NextResponse(videoResponse.body, {
      status: videoResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    reportError(error, "api/twitch/download-clip");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

