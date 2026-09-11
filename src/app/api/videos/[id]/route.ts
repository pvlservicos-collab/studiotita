import { NextRequest, NextResponse } from "next/server";
import { getVideo, setVideoBlob } from "@/lib/services/videos";
import { listAnalysesForVideo } from "@/lib/services/analyses";
import { apiErrorResponse } from "@/lib/apiError";

const notFound = (id: string) =>
  NextResponse.json({ error: `Vídeo ${id} não encontrado.`, code: "NOT_FOUND" }, { status: 404 });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const video = await getVideo(params.id);
    if (!video) return notFound(params.id);
    const analyses = await listAnalysesForVideo(params.id);
    return NextResponse.json({ video, analyses });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** { blob_url } — arquivo do vídeo enviado à mão quando a Meta não libera o original. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { blob_url } = await req.json();
    if (!blob_url) {
      return NextResponse.json({ error: "blob_url é obrigatório.", code: "MISSING_BLOB_URL" }, { status: 400 });
    }
    const video = await setVideoBlob(params.id, blob_url);
    return video ? NextResponse.json({ video }) : notFound(params.id);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
