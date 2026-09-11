import { NextRequest, NextResponse } from "next/server";
import { getFile, updateFile, deleteFile } from "@/lib/services/files";
import { apiErrorResponse } from "@/lib/apiError";

const notFound = () => NextResponse.json({ error: "Arquivo não encontrado.", code: "NOT_FOUND" }, { status: 404 });

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const file = await getFile(params.id);
    return file ? NextResponse.json({ file }) : notFound();
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
