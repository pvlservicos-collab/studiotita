import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { checkCronSecret, runDue } from "@/lib/services/postagens";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Chamado pelo cron da VPS de 5 em 5 minutos (/etc/cron.d/studiotita-postagens).
 * Publica as agendadas que venceram e termina as que estão processando na Meta.
 */
export async function GET(req: NextRequest) {
  if (!checkCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Não autorizado.", code: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runDue());
  } catch (err) {
    return apiErrorResponse(err);
  }
}
export const POST = GET;
