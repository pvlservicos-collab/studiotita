import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { createEditNote, listEditNotes, EDIT_KINDS, type EditKind } from "@/lib/services/editLibrary";

export const dynamic = "force-dynamic";

/** Lista as notas da Biblioteca de Edição (?kind=formato|regra|referencia|guia&q=busca). */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const kind = sp.get("kind") as EditKind | null;
    const notes = await listEditNotes({
      kind: kind && EDIT_KINDS.includes(kind) ? kind : undefined,
      search: sp.get("q") || undefined,
      includeArchived: sp.get("archived") === "1",
    });
    return NextResponse.json({ notes });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.title || !EDIT_KINDS.includes(b.kind)) {
      return NextResponse.json({ error: "Informe title e kind (formato, regra, referencia ou guia).", code: "INPUT_INVALID" }, { status: 400 });
    }
    const note = await createEditNote(b, "painel");
    return NextResponse.json({ note });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
