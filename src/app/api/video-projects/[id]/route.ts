import { NextRequest, NextResponse } from "next/server";
import { deleteVideoProject, getVideoProject, updateVideoProject } from "@/lib/services/videoProjects";
import { apiErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const project = await getVideoProject(params.id);
    if (!project) return NextResponse.json({ error: "Projeto não encontrado.", code: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Salva a linha do tempo (o campo project), o título, o arquivo de origem ou o status. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const project = await updateVideoProject(params.id, body);
    if (!project) return NextResponse.json({ error: "Projeto não encontrado.", code: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ok = await deleteVideoProject(params.id);
    if (!ok) return NextResponse.json({ error: "Projeto não encontrado.", code: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
