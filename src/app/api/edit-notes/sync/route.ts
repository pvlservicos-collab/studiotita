import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { refreshFormatMetrics } from "@/lib/services/editLibrary";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Todo dia (cron da Vercel): puxa os Reels novos, atualiza os números, classifica
 * os novos no formato de edição e guarda as capas. Com CRON_SECRET definido,
 * exige "Authorization: Bearer <CRON_SECRET>" (a Vercel manda sozinha no cron).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado.", code: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    return NextResponse.json(await refreshFormatMetrics());
  } catch (err) {
    return apiErrorResponse(err);
  }
}
