import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getVideoProject } from "@/lib/services/videoProjects";
import { renderizarNoServidor } from "@/lib/services/videoRender";
import { apiErrorResponse } from "@/lib/apiError";

// render é CPU pura: o máximo que o plano Pro dá com fluid compute
export const maxDuration = 800;
export const dynamic = "force-dynamic";

/**
 * Renderiza o projeto no servidor e guarda o mp4 no Blob.
 * Responde na hora com o status; o progresso fica em GET /api/video-projects/<id>.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projeto = await getVideoProject(params.id);
    if (!projeto) return NextResponse.json({ error: "Projeto não encontrado.", code: "NOT_FOUND" }, { status: 404 });
    if (projeto.render_status === "renderizando" || projeto.render_status === "na_fila") {
      return NextResponse.json({ project: projeto, nota: "Já está renderizando." });
    }

    const iniciado = await renderizarNoServidor.iniciar(params.id);
    waitUntil(renderizarNoServidor.processar(params.id));
    return NextResponse.json({ project: iniciado, nota: "Render começou. Acompanhe em GET /api/video-projects/<id>." }, { status: 202 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
