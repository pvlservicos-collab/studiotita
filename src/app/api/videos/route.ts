import { NextRequest, NextResponse } from "next/server";
import { listVideos, createVideo, syncVideosFromMeta } from "@/lib/services/videos";
import { apiErrorResponse } from "@/lib/apiError";

// Sincronizar 100+ posts com as métricas de cada um leva mais que o padrão.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** ?scope=own (padrão) | competitor&competitor_id= | hashtag&tag= | all */
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const videos = await listVideos({
      scope: (sp.get("scope") as "own" | "competitor" | "hashtag" | "all") || "own",
      competitorId: sp.get("competitor_id") || undefined,
      hashtag: sp.get("tag") || undefined,
      search: sp.get("search") || undefined,
    });
    return NextResponse.json({ videos });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body?.action === "sync_meta") {
      const result = await syncVideosFromMeta(body.limit ?? 25);
      return NextResponse.json({ synced: result });
    }

    const video = await createVideo(body);
    return NextResponse.json({ video }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
