import { NextResponse } from "next/server";
import { getVideo } from "@/lib/services/videos";
import { listAnalysesForVideo } from "@/lib/services/analyses";
import { apiErrorResponse } from "@/lib/apiError";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const video = await getVideo(params.id);
    if (!video) {
      return NextResponse.json(
        { error: `Vídeo ${params.id} não encontrado.`, code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    const analyses = await listAnalysesForVideo(params.id);
    return NextResponse.json({ video, analyses });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
