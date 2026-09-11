import { NextRequest, NextResponse } from "next/server";
import { listVideos, createVideo, syncVideosFromMeta } from "@/lib/services/videos";
import { apiErrorResponse } from "@/lib/apiError";

export async function GET() {
  try {
    const videos = await listVideos();
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
