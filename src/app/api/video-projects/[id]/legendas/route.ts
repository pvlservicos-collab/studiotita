import { NextRequest, NextResponse } from "next/server";
import { getVideoProject, updateVideoProject } from "@/lib/services/videoProjects";
import { transcribeVideoWithGemini } from "@/lib/gemini";
import { legendasDeTrechos } from "@/lib/video/captions";
import { apiErrorResponse } from "@/lib/apiError";

// transcrever um vídeo no Gemini leva ~30-90s
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Gera as legendas do arquivo enviado, transcrevendo com o Gemini.
 * Só é preciso quando o vídeo é novo: se ele já tem análise na videoteca, as
 * legendas entram da transcrição na hora de criar o projeto.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const row = await getVideoProject(params.id);
    if (!row) return NextResponse.json({ error: "Projeto não encontrado.", code: "NOT_FOUND" }, { status: 404 });
    const url = row.project?.fonte?.url || row.source_url;
    if (!url) {
      return NextResponse.json({ error: "Envie o vídeo antes de gerar as legendas.", code: "NO_SOURCE" }, { status: 400 });
    }

    const { trechos, model } = await transcribeVideoWithGemini(url);
    const legendas = legendasDeTrechos(trechos, { duracao: row.project?.fonte?.duracao });
    const projeto = { ...row.project, legendas };
    const salvo = await updateVideoProject(params.id, { project: projeto });
    return NextResponse.json({ project: salvo, legendas: legendas.length, model });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
