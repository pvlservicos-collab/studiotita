import { NextRequest, NextResponse } from "next/server";
import { requestAnalysis } from "@/lib/services/analyses";
import { apiErrorResponse } from "@/lib/apiError";

// A análise continua depois da resposta (waitUntil): download + upload do
// vídeo + Gemini cabem nesse limite.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.video_id) {
      return NextResponse.json(
        { error: "video_id é obrigatório.", code: "MISSING_VIDEO_ID" },
        { status: 400 }
      );
    }
    const analysis = await requestAnalysis(body.video_id, body.requested_by ?? "pedro");
    return NextResponse.json({ analysis }, { status: 202 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
