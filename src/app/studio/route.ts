import { readFile } from "node:fs/promises";
import path from "node:path";

// Página avulsa do Estúdio em /studio: serve studio/estudio-reels.html como está,
// sem o layout do painel. Gerada no build (estática).
export const dynamic = "force-static";

export async function GET() {
  const html = await readFile(path.join(process.cwd(), "studio", "estudio-reels.html"), "utf8");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
