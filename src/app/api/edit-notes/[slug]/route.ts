import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getEditNote, updateEditNote } from "@/lib/services/editLibrary";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    return NextResponse.json({ note: await getEditNote(decodeURIComponent(params.slug)) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { change_note, ...patch } = await req.json();
    const note = await updateEditNote(decodeURIComponent(params.slug), patch, "painel", change_note || "editada no painel");
    return NextResponse.json({ note });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Arquiva (não apaga): o histórico continua guardado. */
export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const note = await updateEditNote(decodeURIComponent(params.slug), { archived: true }, "painel", "arquivada");
    return NextResponse.json({ note });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
