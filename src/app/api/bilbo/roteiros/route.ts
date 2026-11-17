import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { savedScripts } from "@/lib/services/bilbo";

export const dynamic = "force-dynamic";

/** Aba "Roteiros salvos". */
export async function GET(_req: NextRequest) {
  try {
    return NextResponse.json({ scripts: await savedScripts() });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
