import { NextRequest, NextResponse } from "next/server";
import { fetchAccountMetrics } from "@/lib/meta";
import { apiErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/** Métricas da conta ao vivo da Meta. ?days=1..28 (padrão 28). */
export async function GET(req: NextRequest) {
  try {
    const days = Number(new URL(req.url).searchParams.get("days") || 28);
    const metrics = await fetchAccountMetrics(days);
    return NextResponse.json({ metrics });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
