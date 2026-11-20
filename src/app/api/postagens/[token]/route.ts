import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { publicView, updatePostagem } from "@/lib/services/postagens";

export const dynamic = "force-dynamic";
// ler a postagem também empurra a publicação (criar o container, conferir o processamento, publicar)
export const maxDuration = 60;

/** A página /postar/<token>: os campos, o status e os links de envio para a VPS. O token é a senha. */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    return NextResponse.json(await publicView(params.token));
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Salva os campos editados na página. */
export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    await updatePostagem(params.token, await req.json());
    return NextResponse.json(await publicView(params.token));
  } catch (err) {
    return apiErrorResponse(err);
  }
}
