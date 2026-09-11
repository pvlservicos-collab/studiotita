import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

/**
 * Gera o token para o navegador enviar o arquivo direto ao Vercel Blob
 * (sem passar pelo limite de 4,5 MB do corpo das funções). Depois do envio,
 * o navegador chama POST /api/files para registrar e extrair o texto.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        addRandomSuffix: true,
        maximumSizeInBytes: 200 * 1024 * 1024,
      }),
      // O registro no banco é feito pelo navegador em POST /api/files.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, code: "UPLOAD_FAILED" }, { status: 400 });
  }
}
