import { NextRequest, NextResponse } from "next/server";
import { listScripts, createScript } from "@/lib/services/scripts";
import { apiErrorResponse } from "@/lib/apiError";

export async function GET() {
  try {
    const scripts = await listScripts();
    return NextResponse.json({ scripts });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.full_script) {
      return NextResponse.json(
        { error: "full_script é obrigatório.", code: "MISSING_FULL_SCRIPT" },
        { status: 400 }
      );
    }
    const script = await createScript(body);
    return NextResponse.json({ script }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
