import { NextRequest } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { buildFormatPrompt } from "@/lib/services/editLibrary";

export const dynamic = "force-dynamic";

/** Prompt pronto (texto) para colar no Claude e editar um vídeo neste formato. */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    return new Response(await buildFormatPrompt(decodeURIComponent(params.slug)), { headers: { "content-type": "text/plain; charset=utf-8" } });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
