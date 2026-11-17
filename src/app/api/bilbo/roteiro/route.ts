import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { pegarRoteiro, removeSaved } from "@/lib/services/bilbo";

export const dynamic = "force-dynamic";
// a análise frame a frame roda em background (waitUntil) dentro deste limite
export const maxDuration = 300;

/** "Pegar roteiro": salva o post e manda para a análise frame a frame. */
export async function POST(req: NextRequest) {
  try {
    const { video_id } = await req.json();
    return NextResponse.json(await pegarRoteiro(video_id, "painel"));
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await removeSaved(req.nextUrl.searchParams.get("video_id") || "");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
