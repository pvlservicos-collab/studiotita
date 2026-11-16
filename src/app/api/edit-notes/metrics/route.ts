import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { formatMetrics } from "@/lib/services/editLibrary";

export const dynamic = "force-dynamic";

/** Desempenho de cada formato de edição (números da Meta dos vídeos do Augusto). */
export async function GET() {
  try {
    return NextResponse.json({ metrics: await formatMetrics() });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
