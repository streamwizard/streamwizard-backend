import { GetClipDownloadURL } from "@/actions/twitch/clips";
import { createClient } from "@repo/supabase/next/server";
import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@repo/sentry";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clipId } = await request.json();

    if (!clipId) {
      return NextResponse.json(
        { error: "Missing clipId" },
        { status: 400 }
      );
    }

    const result = await GetClipDownloadURL(clipId, user.id);

    if (!result.success || !result.data?.data?.[0]) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    const clip = result.data.data[0];

    return NextResponse.json({
      landscape_url: clip.landscape_download_url,
      portrait_url: clip.portrait_download_url,
    });
  } catch (error) {
    reportError(error, "api/overlays/preview");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
