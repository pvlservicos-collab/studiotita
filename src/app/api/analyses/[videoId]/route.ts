import { NextResponse } from "next/server";
import { getLatestAnalysis } from "@/lib/services/analyses";
import { apiErrorResponse } from "@/lib/apiError";

// Usado pela UI para fazer polling do status (pending/processing/done/error).
export async function GET(_req: Request, { params }: { params: { videoId: string } }) {
  try {
    const analysis = await getLatestAnalysis(params.videoId);
    if (!analysis) {
      return NextResponse.json(
        { error: "Nenhuma análise encontrada para este vídeo ainda.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json({ analysis });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
