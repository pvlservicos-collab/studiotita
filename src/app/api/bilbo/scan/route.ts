import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { scan } from "@/lib/services/bilbo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Varredura (cron diário da Vercel ou botão "Varrer agora"). */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const isCron = req.headers.get("user-agent")?.includes("vercel-cron");
  if (secret && isCron && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado.", code: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    return NextResponse.json(await scan());
  } catch (err) {
    return apiErrorResponse(err);
  }
}
export const GET = run;
export const POST = run;
