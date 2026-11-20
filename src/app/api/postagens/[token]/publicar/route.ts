import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { cancelarAgendamento, publicar, publicView } from "@/lib/services/postagens";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Botões Postar agora ({}) e Agendar ({ "quando": ISO }). Só o Augusto clica: o Claude nunca chama esta rota. */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    await publicar(params.token, body?.quando ?? null);
    return NextResponse.json(await publicView(params.token));
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Cancelar o agendamento (volta para rascunho). */
export async function DELETE(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    await cancelarAgendamento(params.token);
    return NextResponse.json(await publicView(params.token));
  } catch (err) {
    return apiErrorResponse(err);
  }
}
