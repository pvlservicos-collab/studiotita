import { NextRequest, NextResponse } from "next/server";
import { listFiles, registerUploadedFile, createTextFile } from "@/lib/services/files";
import { apiErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";
// PDFs grandes levam alguns segundos para ter o texto extraído.
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const files = await listFiles({
      category: searchParams.get("category") || undefined,
      search: searchParams.get("search") || undefined,
    });
    return NextResponse.json({ files });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/**
 * Dois formatos:
 *  - { blob_url, name, content_type, size_bytes, category } → arquivo já enviado ao Blob pelo navegador
 *  - { name, text, category } → texto colado direto
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const file = body.blob_url
      ? await registerUploadedFile(body)
      : await createTextFile({ ...body, source: "upload" });
    return NextResponse.json({ file }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
