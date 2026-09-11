import { NextRequest, NextResponse } from "next/server";
import { buildGenerationPrompt, generateScript, type GenerateOptions } from "@/lib/services/scriptGenerator";
import { listCategories } from "@/lib/services/categories";
import { listCompetitors } from "@/lib/services/competitors";
import { apiErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** O que dá para escolher na tela "Criar roteiro": categorias (do Augusto e de concorrentes) e concorrentes. */
export async function GET() {
  try {
    const [categories, competitors] = await Promise.all([listCategories(), listCompetitors()]);
    return NextResponse.json({
      own_categories: categories.filter((c) => c.origin === "own").map((c) => ({ name: c.name, videos: c.enabled_count })),
      competitor_categories: categories.filter((c) => c.origin !== "own").map((c) => ({ name: c.name, videos: c.enabled_count })),
      competitors: competitors.map((c) => ({ id: c.id, username: c.username, videos: c.video_count ?? 0 })),
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Gera o roteiro ({ ...GenerateOptions }) ou só devolve o pedido montado ({ preview: true, ... }). */
export async function POST(req: NextRequest) {
  try {
    const { preview, ...options } = (await req.json()) as GenerateOptions & { preview?: boolean };
    if (preview) {
      const built = await buildGenerationPrompt(options);
      return NextResponse.json({ prompt: built.prompt, references: built.referenceIds.length, label: built.label });
    }
    const script = await generateScript(options, "pedro");
    return NextResponse.json({ script }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
