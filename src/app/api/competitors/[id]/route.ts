import { NextRequest, NextResponse } from "next/server";
import { getCompetitor, getOwnStats, removeCompetitor, syncCompetitor } from "@/lib/services/competitors";
import { apiErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const notFound = () => NextResponse.json({ error: "Concorrente não encontrado.", code: "NOT_FOUND" }, { status: 404 });

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [competitor, own] = await Promise.all([getCompetitor(params.id), getOwnStats()]);
    return competitor ? NextResponse.json({ competitor, own }) : notFound();
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Atualiza perfil e posts: { limit? } (padrão 200, máx. 500). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 500);
    return NextResponse.json(await syncCompetitor(params.id, limit));
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    return (await removeCompetitor(params.id)) ? NextResponse.json({ deleted: true }) : notFound();
  } catch (err) {
    return apiErrorResponse(err);
  }
}
