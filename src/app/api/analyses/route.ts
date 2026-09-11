import { NextRequest, NextResponse } from "next/server";
import { categoriesHint, requestAnalysis, updateAnalysis } from "@/lib/services/analyses";
import { DEFAULT_ANALYSIS_PROMPT } from "@/lib/gemini";
import { apiErrorResponse } from "@/lib/apiError";

// A análise continua depois da resposta (waitUntil): download + upload do
// vídeo + Gemini cabem nesse limite.
export const maxDuration = 300;

export const dynamic = "force-dynamic";

/** Prompt padrão, modelo e o trecho de categorias que é acrescentado ao fim do prompt. */
export async function GET() {
  try {
    return NextResponse.json({
      default_prompt: DEFAULT_ANALYSIS_PROMPT,
      categories_hint: (await categoriesHint()).trim(),
      model: process.env.GEMINI_MODEL || "gemini-2.5-pro",
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.video_id) {
      return NextResponse.json(
        { error: "video_id é obrigatório.", code: "MISSING_VIDEO_ID" },
        { status: 400 }
      );
    }
    const analysis = await requestAnalysis(body.video_id, body.requested_by ?? "pedro", body.prompt);
    return NextResponse.json({ analysis }, { status: 202 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Edita resumo, transcrição ou adequação às regras: { id, summary?, transcript?, rules_fit? } */
export async function PATCH(req: NextRequest) {
  try {
    const { id, summary, transcript, rules_fit } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id é obrigatório.", code: "MISSING_ID" }, { status: 400 });
    }
    const analysis = await updateAnalysis(id, { summary, transcript, rules_fit });
    if (!analysis) {
      return NextResponse.json({ error: "Análise não encontrada.", code: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ analysis });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
