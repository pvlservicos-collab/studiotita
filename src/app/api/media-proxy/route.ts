import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Serve um arquivo de mídia (vídeo do Blob, música) pela NOSSA origem.
 *
 * Sem isso, o canvas do editor fica "sujo" (tainted) ao desenhar um vídeo de
 * outro domínio e a exportação falha. O proxy repassa o cabeçalho Range, para
 * o navegador continuar buscando qualquer ponto do vídeo.
 *
 * Só libera domínios conhecidos (Vercel Blob e as CDNs da Meta).
 */
const PERMITIDOS = [
  /\.public\.blob\.vercel-storage\.com$/i,
  /\.blob\.vercel-storage\.com$/i,
  /\.cdninstagram\.com$/i,
  /\.fbcdn\.net$/i,
];

export async function GET(req: NextRequest) {
  const alvo = new URL(req.url).searchParams.get("url");
  if (!alvo) {
    return NextResponse.json({ error: "Faltou o parâmetro url.", code: "MISSING_URL" }, { status: 400 });
  }

  let destino: URL;
  try {
    destino = new URL(alvo);
  } catch {
    return NextResponse.json({ error: "URL inválida.", code: "BAD_URL" }, { status: 400 });
  }
  if (destino.protocol !== "https:" || !PERMITIDOS.some((re) => re.test(destino.hostname))) {
    return NextResponse.json(
      { error: `Domínio não liberado no proxy de mídia: ${destino.hostname}`, code: "HOST_NOT_ALLOWED" },
      { status: 403 }
    );
  }

  const range = req.headers.get("range");
  const upstream = await fetch(destino.toString(), {
    headers: range ? { range } : undefined,
    cache: "no-store",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `A origem respondeu ${upstream.status} para este arquivo.`, code: "UPSTREAM_ERROR" },
      { status: 502 }
    );
  }

  const headers = new Headers();
  for (const chave of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const valor = upstream.headers.get(chave);
    if (valor) headers.set(chave, valor);
  }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=3600");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
