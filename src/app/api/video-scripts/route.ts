import { NextRequest, NextResponse } from "next/server";
import { listVideoScripts } from "@/lib/services/videoScripts";
import { apiErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/** Roteiros extraídos dos vídeos analisados. ?scope=own|competitor|all &search= &competitor_id= */
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const scripts = await listVideoScripts({
      scope: (sp.get("scope") as "own" | "competitor" | "all") || "all",
      competitorId: sp.get("competitor_id") || undefined,
      search: sp.get("search") || undefined,
    });
    return NextResponse.json({ scripts });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
