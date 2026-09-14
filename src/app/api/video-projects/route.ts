import { NextRequest, NextResponse } from "next/server";
import { createVideoProject, listVideoProjects } from "@/lib/services/videoProjects";
import { apiErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/** Projetos da aba Vídeo. */
export async function GET() {
  try {
    return NextResponse.json({ projects: await listVideoProjects() });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Cria um projeto (já com as telas da metadinha e as legendas da transcrição). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const project = await createVideoProject({
      title: body?.title,
      flow_id: body?.flow_id ?? null,
      video_id: body?.video_id ?? null,
      script_id: body?.script_id ?? null,
      source_url: body?.source_url ?? null,
      source_name: body?.source_name ?? null,
      duration: body?.duration ?? null,
      created_by: body?.created_by ?? "pedro",
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
