import { NextRequest, NextResponse } from "next/server";
import { listScripts, createScript, deleteScripts } from "@/lib/services/scripts";
import { apiErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const scripts = await listScripts();
    return NextResponse.json({ scripts });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.full_script) {
      return NextResponse.json(
        { error: "full_script é obrigatório.", code: "MISSING_FULL_SCRIPT" },
        { status: 400 }
      );
    }
    const script = await createScript({
      title: body.title,
      full_script: body.full_script,
      hook: body.hook ?? "",
      structure: body.structure ?? "",
      video_id: body.video_id ?? null,
      status: body.status,
      category: body.category ?? null,
      source: "manual",
      created_by: body.created_by ?? "pedro",
    });
    return NextResponse.json({ script }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Exclusão em lote: { ids: string[] } */
export async function DELETE(req: NextRequest) {
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || !ids.length) {
      return NextResponse.json({ error: "Informe os ids dos roteiros.", code: "INPUT_INVALID" }, { status: 400 });
    }
    return NextResponse.json({ deleted: await deleteScripts(ids) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
