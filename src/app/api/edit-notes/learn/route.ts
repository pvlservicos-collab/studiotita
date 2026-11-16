import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { learnCompetitorEdit } from "@/lib/services/editLibrary";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Vídeo ou print de concorrente (URL pública, ex.: Vercel Blob) → Gemini → nota de referência com prompt. */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.media_url) return NextResponse.json({ error: "Envie media_url (vídeo ou imagem).", code: "INPUT_INVALID" }, { status: 400 });
    const note = await learnCompetitorEdit(b, "painel");
    return NextResponse.json({ note });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
