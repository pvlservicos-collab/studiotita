import { NextRequest, NextResponse } from "next/server";
import {
  generateFlowForVideo,
  generateStudioFlow,
  getFlowForAnalysis,
  listStudioFlows,
  padroesText,
} from "@/lib/services/studioFlows";
import { apiErrorResponse } from "@/lib/apiError";

// Montar a metadinha é uma chamada de texto ao Gemini (~30-60s).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Fluxos do Estúdio Reels.
 * GET  ?kind=referencia|gerado &video_id= &analysis_id= &limit=
 * POST { analysis_id } ou { video_id } — monta a metadinha com o Gemini.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const analysisId = sp.get("analysis_id");
    if (analysisId) {
      return NextResponse.json({ flow: await getFlowForAnalysis(analysisId) });
    }
    const kind = sp.get("kind");
    const flows = await listStudioFlows({
      kind: kind === "referencia" || kind === "gerado" ? kind : undefined,
      videoId: sp.get("video_id") || undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    });
    const padroes = await padroesText();
    return NextResponse.json({ flows, padroes: padroes.text, padroes_source: padroes.source });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const createdBy = body?.created_by ?? "pedro";
    if (body?.analysis_id) {
      return NextResponse.json({ flow: await generateStudioFlow(body.analysis_id, createdBy) });
    }
    if (body?.video_id) {
      return NextResponse.json({ flow: await generateFlowForVideo(body.video_id, createdBy) });
    }
    return NextResponse.json({ error: "Passe analysis_id ou video_id.", code: "MISSING_ID" }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
