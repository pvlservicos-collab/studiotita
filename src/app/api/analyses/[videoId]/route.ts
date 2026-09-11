import { NextResponse } from "next/server";
import { listAnalysesForVideo } from "@/lib/services/analyses";
import { apiErrorResponse } from "@/lib/apiError";

// Usado pela UI para fazer polling do status (pending/processing/done/error)
// e para mostrar o histórico de análises do vídeo.
export async function GET(_req: Request, { params }: { params: { videoId: string } }) {
  try {
    const history = await listAnalysesForVideo(params.videoId);
    if (history.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma análise encontrada para este vídeo ainda.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json({ analysis: history[0], history });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
