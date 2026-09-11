import { NextRequest, NextResponse } from "next/server";
import { listCategories, setCategorySelection, compileCategoryScripts, defaultGenerationInstructions } from "@/lib/services/categories";
import { apiErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/**
 * GET → todas as categorias com os vídeos
 * GET ?compile=<categoria> → roteiros dos vídeos ligados, em Markdown
 * GET ?instructions=<categoria> → instruções padrão do pedido de roteiro novo
 */
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    if (sp.get("compile")) return NextResponse.json(await compileCategoryScripts(sp.get("compile")!));
    if (sp.get("instructions")) {
      return NextResponse.json({ instructions: await defaultGenerationInstructions(sp.get("instructions")!) });
    }
    return NextResponse.json({ categories: await listCategories() });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Liga/desliga um vídeo da seleção de uma categoria: { category, video_id, enabled } */
export async function PUT(req: NextRequest) {
  try {
    const { category, video_id, enabled } = await req.json();
    if (!category || !video_id || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "category, video_id e enabled são obrigatórios.", code: "INPUT_INVALID" }, { status: 400 });
    }
    await setCategorySelection(category, video_id, enabled);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
