import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { scriptFromPost } from "@/lib/services/bilbo";

export const dynamic = "force-dynamic";
// extrai o roteiro do original (Gemini, ~1 min) e escreve o roteiro novo do Augusto
export const maxDuration = 300;

/** "Gerar roteiro" do botão Melhores: o roteiro novo do Augusto a partir de um post em alta. */
export async function POST(req: NextRequest) {
  try {
    const { video_id, subject } = await req.json();
    return NextResponse.json(await scriptFromPost(video_id, { subject: subject || null }, "painel"));
  } catch (err) {
    return apiErrorResponse(err);
  }
}
