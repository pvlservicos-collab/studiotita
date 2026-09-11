import { NextRequest, NextResponse } from "next/server";
import { requestAnalysis, updateAnalysis } from "@/lib/services/analyses";
import { DEFAULT_ANALYSIS_PROMPT } from "@/lib/gemini";
import { apiErrorResponse } from "@/lib/apiError";

// A análise continua depois da resposta (waitUntil): download + upload do
// vídeo + Gemini cabem nesse limite.
export const maxDuration = 300;

/** Prompt padrão e modelo, para o painel mostrar antes de enviar. */
export async function GET() {
  return NextResponse.json({
    default_prompt: DEFAULT_ANALYSIS_PROMPT,
    model: process.env.GEMINI_MODEL || "gemini-2.5-pro",
  });
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
