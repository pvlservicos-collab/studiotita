import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { overview } from "@/lib/services/bilbo";

export const dynamic = "force-dynamic";

/** Aba "Virais da semana": concorrentes vigiados, posts recentes e melhores da semana. */
export async function GET(_req: NextRequest) {
  try {
    return NextResponse.json(await overview());
  } catch (err) {
    return apiErrorResponse(err);
  }
}
