import { NextRequest, NextResponse } from "next/server";
import { getHashtagQuota, listHashtagSearches, searchHashtag } from "@/lib/services/hashtags";
import { apiErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Histórico de buscas + cota da semana (30 hashtags diferentes a cada 7 dias). */
export async function GET() {
  try {
    const [history, quota] = await Promise.all([listHashtagSearches(), getHashtagQuota()]);
    return NextResponse.json({ history, quota });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** { hashtag, edge: "top_media" | "recent_media" } */
export async function POST(req: NextRequest) {
  try {
    const { hashtag, edge } = await req.json();
    return NextResponse.json(await searchHashtag(String(hashtag ?? ""), edge === "recent_media" ? "recent_media" : "top_media"));
  } catch (err) {
    return apiErrorResponse(err);
  }
}
