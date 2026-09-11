import { NextRequest, NextResponse } from "next/server";
import { getFile, updateFile, deleteFile } from "@/lib/services/files";
import { apiErrorResponse } from "@/lib/apiError";

const notFound = () => NextResponse.json({ error: "Arquivo não encontrado.", code: "NOT_FOUND" }, { status: 404 });

/** O texto vem cortado em 20 mil caracteres (?full=1 traz inteiro); a navegação completa é pelas seções. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const file = await getFile(params.id);
    if (!file) return notFound();
    const full = new URL(req.url).searchParams.get("full") === "1";
    const text = file.text_content ?? null;
    return NextResponse.json({
      file: { ...file, text_content: full || !text ? text : text.slice(0, 20000), text_length: text?.length ?? 0 },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const file = await updateFile(params.id, await req.json());
    return file ? NextResponse.json({ file }) : notFound();
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    return (await deleteFile(params.id)) ? NextResponse.json({ deleted: true }) : notFound();
  } catch (err) {
    return apiErrorResponse(err);
  }
}
