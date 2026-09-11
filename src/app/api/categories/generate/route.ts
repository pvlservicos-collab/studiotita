import { NextRequest, NextResponse } from "next/server";
import { generateCategoryScript } from "@/lib/services/categories";
import { apiErrorResponse } from "@/lib/apiError";

// Pedido só de texto ao Gemini, mas com vários roteiros de referência.
export const maxDuration = 120;

/** { category, instructions? } → cria um roteiro novo (source "gemini") em Roteiros. */
export async function POST(req: NextRequest) {
  try {
    const { category, instructions } = await req.json();
    if (!category) {
      return NextResponse.json({ error: "category é obrigatório.", code: "INPUT_INVALID" }, { status: 400 });
    }
    const script = await generateCategoryScript(category, instructions, "pedro");
    return NextResponse.json({ script }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
