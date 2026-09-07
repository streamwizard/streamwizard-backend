import { createClient } from "@repo/supabase/next/server";
import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@repo/sentry";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Unauthorized:", authError);  
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = request.nextUrl.searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const headers: Record<string, string> = {};
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const upstream = await fetch(url, { headers });

    if (!upstream.ok && upstream.status !== 206) {
      console.error("Failed to fetch video:", upstream.status);
      return NextResponse.json(
        { error: "Failed to fetch video" },
        { status: upstream.status }
      );
    }

    const responseHeaders: Record<string, string> = {
      "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
      "Accept-Ranges": "bytes",
    };

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) responseHeaders["Content-Range"] = contentRange;

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    reportError(error, "api/overlays/preview/stream");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stream error" },
      { status: 500 }
    );
  }
}
