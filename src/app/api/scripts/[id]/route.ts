import { NextRequest, NextResponse } from "next/server";
import { getScript, updateScript } from "@/lib/services/scripts";
import { apiErrorResponse } from "@/lib/apiError";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const script = await getScript(params.id);
    if (!script) {
      return NextResponse.json(
        { error: `Roteiro ${params.id} não encontrado.`, code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json({ script });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const script = await updateScript(params.id, body);
    if (!script) {
      return NextResponse.json(
        { error: `Roteiro ${params.id} não encontrado.`, code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json({ script });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
