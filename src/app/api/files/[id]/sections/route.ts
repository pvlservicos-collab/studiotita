import { NextRequest, NextResponse } from "next/server";
import { getSection, listSections } from "@/lib/services/files";
import { apiErrorResponse } from "@/lib/apiError";

/** Títulos (seções) de um arquivo; ?section=<id> traz o conteúdo de uma seção. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sectionId = new URL(req.url).searchParams.get("section");
    if (sectionId) {
      const section = await getSection(sectionId);
      if (!section || section.file_id !== params.id) {
        return NextResponse.json({ error: "Seção não encontrada.", code: "NOT_FOUND" }, { status: 404 });
      }
      return NextResponse.json({ section });
    }
    return NextResponse.json({ sections: await listSections(params.id) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
