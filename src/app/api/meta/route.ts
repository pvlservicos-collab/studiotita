import { NextRequest, NextResponse } from "next/server";
import { getLatestInsights, syncAccountInsights } from "@/lib/services/insights";
import { apiErrorResponse } from "@/lib/apiError";

export async function GET() {
  try {
    const insights = await getLatestInsights();
    return NextResponse.json({ insights });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(_req: NextRequest) {
  try {
    const result = await syncAccountInsights();
    return NextResponse.json({ synced: result });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
