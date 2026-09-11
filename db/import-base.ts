/**
 * Importa a pasta "arquivos base" para a Biblioteca: envia cada arquivo ao
 * Vercel Blob, extrai o texto, divide em seções por título e grava no banco.
 *
 * Uso: npm run import:base            (pasta padrão: ./arquivos base)
 *      npm run import:base -- "C:\outra\pasta"
 *
 * Pode rodar de novo quando quiser: arquivos já importados e iguais são
 * pulados; arquivos alterados (tamanho diferente) são atualizados.
 */
import { config as loadEnv } from "dotenv";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

loadEnv({ path: path.join(__dirname, "..", ".env.local") });

const SKIP = [/\.zip$/i, /(^|[\\/])LEIA-ME\.txt$/i, /desktop\.ini$/i, /Thumbs\.db$/i];

// Categoria pela pasta de origem (ver LEIA-ME da pasta).
function categoryFor(rel: string): string {
  const p = rel.toLowerCase();
  if (p.includes("metodo-de-roteiro")) return "metodo_roteiro";
  if (p.includes("briefing") || p.includes("instrucoes")) return "briefing";
  if (p.includes("referencias-cientificas")) return "referencia_cientifica";
  if (/\.(png|jpe?g|gif|webp)$/.test(p)) return "imagem";
  if (p.includes("base_de_ensino") || p.includes("aulas") || p.includes("transcri")) return "transcricao_aula";
  if (p.includes("roteiro")) return "roteiro_antigo";
  return "outro";
}

const CONTENT_TYPES: Record<string, string> = {
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

async function main() {
  const baseDir = path.resolve(process.argv[2] || path.join(__dirname, "..", "arquivos base"));
  if (!existsSync(baseDir)) {
    console.error(`Pasta não encontrada: ${baseDir}`);
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN não definido no .env.local.");
    process.exit(1);
  }

  // imports depois do dotenv: db.ts lê DATABASE_URL na primeira consulta
  const { put } = await import("@vercel/blob");
  const { query, queryOne, getPool } = await import("../src/lib/db");
  const { extractText, rebuildSections } = await import("../src/lib/services/files");

  const seenHashes = new Set<string>();
  const summary = { criados: 0, atualizados: 0, pulados: 0, duplicados: 0 };

  for (const full of walk(baseDir)) {
    const rel = path.relative(baseDir, full).split(path.sep).join("/");
    if (SKIP.some((r) => r.test(rel))) continue;

    const buffer = readFileSync(full);
    const hash = createHash("sha1").update(buffer).digest("hex");
    if (seenHashes.has(hash)) {
      summary.duplicados++;
      console.log(`= duplicado (mesmo conteúdo de outro arquivo): ${rel}`);
      continue;
    }
    seenHashes.add(hash);

    const sourcePath = `arquivos base/${rel}`;
    const existing = await queryOne<{ id: string; size_bytes: number }>(
      `select id, size_bytes from files where source_path = $1`,
      [sourcePath]
    );
    if (existing && Number(existing.size_bytes) === buffer.byteLength) {
      summary.pulados++;
      continue;
    }

    const name = path.basename(full);
    const ext = path.extname(name).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
    const category = categoryFor(rel);
    const description = `Importado da pasta "arquivos base": ${path.dirname(rel) === "." ? "raiz" : path.dirname(rel)}`;

    const blob = await put(`biblioteca/${rel}`, buffer, { access: "public", addRandomSuffix: true, contentType });
    const text = await extractText(buffer, name, contentType);

    let fileId: string;
    if (existing) {
      await query(
        `update files set blob_url = $2, content_type = $3, size_bytes = $4, text_content = $5, category = $6 where id = $1`,
        [existing.id, blob.url, contentType, buffer.byteLength, text, category]
      );
      fileId = existing.id;
      summary.atualizados++;
    } else {
      const row = await queryOne<{ id: string }>(
        `insert into files (name, category, description, blob_url, content_type, size_bytes, text_content, source, created_by, source_path)
         values ($1, $2, $3, $4, $5, $6, $7, 'upload', 'importacao:arquivos-base', $8)
         returning id`,
        [name, category, description, blob.url, contentType, buffer.byteLength, text, sourcePath]
      );
      fileId = row!.id;
      summary.criados++;
    }
    const sections = await rebuildSections(fileId, text, name, category);
    console.log(`${existing ? "↻" : "+"} ${rel} → ${category} · ${text ? `${text.length} caracteres` : "sem texto"} · ${sections} seções`);
  }

  console.log(`\nPronto: ${summary.criados} criados, ${summary.atualizados} atualizados, ${summary.pulados} já estavam iguais, ${summary.duplicados} duplicados ignorados.`);
  await getPool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
