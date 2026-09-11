import { NextRequest, NextResponse } from "next/server";
import { getHashtagQuota, listHashtagSearches, searchHashtag } from "@/lib/services/hashtags";
import { apiErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Histórico de buscas + cota da semana (30 hashtags diferentes a cada 7 dias). */
export async function GET() {
  try {
    const [history, quota] = await Promise.all([listHashtagSearches(), getHashtagQuota()]);
    return NextResponse.json({ history, quota });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** { hashtag, edge: "top_media" | "recent_media", limit? } */
export async function POST(req: NextRequest) {
  try {
    const { hashtag, edge, limit } = await req.json();
    return NextResponse.json(
      await searchHashtag(String(hashtag ?? ""), edge === "recent_media" ? "recent_media" : "top_media", Math.min(Math.max(Number(limit) || 50, 5), 100))
    );
  } catch (err) {
    return apiErrorResponse(err);
  }
}
