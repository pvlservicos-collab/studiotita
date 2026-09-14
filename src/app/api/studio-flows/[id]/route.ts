import { NextRequest, NextResponse } from "next/server";
import { deleteStudioFlow, getStudioFlow, linkStudioFlow } from "@/lib/services/studioFlows";
import { toStudioProject } from "@/lib/studio/scenes";
import type { StudioScene } from "@/lib/studio/scenes";
import { apiErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/**
 * GET /api/studio-flows/<id>              → o fluxo inteiro
 * GET /api/studio-flows/<id>?formato=estudio → só o projeto, no formato que o
 *   estúdio abre (é o que /estudio-reels.html?fluxo=<id> busca).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const flow = await getStudioFlow(params.id);
    if (!flow) {
      return NextResponse.json({ error: "Fluxo não encontrado.", code: "NOT_FOUND" }, { status: 404 });
    }
    if (new URL(req.url).searchParams.get("formato") === "estudio") {
      const project = flow.project ?? toStudioProject((flow.scenes as StudioScene[]) ?? []);
      return NextResponse.json(project);
    }
    return NextResponse.json({ flow });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Liga o fluxo a um vídeo (ou desliga com video_id: null). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { video_id, link_reason } = await req.json();
    const flow = await linkStudioFlow(params.id, video_id ?? null, link_reason);
    if (!flow) {
      return NextResponse.json({ error: "Fluxo não encontrado.", code: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ flow });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ok = await deleteStudioFlow(params.id);
    if (!ok) {
      return NextResponse.json({ error: "Fluxo não encontrado.", code: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
