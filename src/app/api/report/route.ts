import { NextRequest, NextResponse } from "next/server";
import { buildReport } from "@/lib/services/report";
import { apiErrorResponse } from "@/lib/apiError";
import type { PeriodId, RankMetric } from "@/lib/periods";

export const dynamic = "force-dynamic";

/**
 * Relatório em Markdown dos posts de um escopo.
 * ?scope=own|competitor|hashtag &competitor_id= &tag= &mode=all|best &period= &metric= &top= &transcripts=1
 */
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const report = await buildReport({
      scope: (sp.get("scope") as "own" | "competitor" | "hashtag") || "own",
      competitorId: sp.get("competitor_id") || undefined,
      hashtag: sp.get("tag") || undefined,
      search: sp.get("search") || undefined,
      mode: sp.get("mode") === "best" ? "best" : "all",
      period: (sp.get("period") as PeriodId) || undefined,
      metric: (sp.get("metric") as RankMetric) || undefined,
      top: sp.get("top") ? Number(sp.get("top")) : undefined,
      includeTranscripts: sp.get("transcripts") === "1",
    });
    return NextResponse.json(report);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
