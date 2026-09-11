import { NextRequest, NextResponse } from "next/server";
import { addCompetitors, getOwnStats, listCompetitors } from "@/lib/services/competitors";
import { fetchAccountSummary } from "@/lib/meta";
import { apiErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Concorrentes + as médias do Augusto para comparar. */
export async function GET() {
  try {
    const [competitors, own, profile] = await Promise.all([
      listCompetitors(),
      getOwnStats(),
      fetchAccountSummary().catch(() => null),
    ]);
    return NextResponse.json({
      competitors,
      own: { ...own, username: profile?.username ?? "augustotita", followers_count: profile?.followers_count ?? null, profile_picture_url: profile?.profile_picture_url ?? null },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** { input } — links do Instagram ou @usuarios (vários por linha, vírgula ou espaço). */
export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json();
    const results = await addCompetitors(String(input ?? ""));
    return NextResponse.json({ results }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
