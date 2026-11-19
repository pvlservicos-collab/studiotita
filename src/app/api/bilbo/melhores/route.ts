import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { trending } from "@/lib/services/bilbo";

export const dynamic = "force-dynamic";

/** Botão "Melhores" do Bilbo: ranking por perfil de todos os concorrentes (o mesmo do conector). */
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    return NextResponse.json(
      await trending({ days: Number(p.get("days")) || undefined, perProfile: Number(p.get("por_perfil")) || undefined })
    );
  } catch (err) {
    return apiErrorResponse(err);
  }
}
