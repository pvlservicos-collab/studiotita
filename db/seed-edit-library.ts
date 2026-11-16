/**
 * Carrega o conteúdo inicial da Biblioteca de Edição (pasta biblioteca-edicao/):
 * formatos, guias e regras do Titã aprendidos nas edições feitas até aqui.
 * Só cria o que ainda não existe (pelo slug) — nunca sobrescreve o que o
 * Augusto ou um Claude já editou. Uso: npm run seed:edicao
 */
import { config as loadEnv } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

loadEnv({ path: path.join(__dirname, "..", ".env.local") });

const dir = path.join(__dirname, "..", "biblioteca-edicao");

function parse(file: string) {
  const raw = readFileSync(path.join(dir, file), "utf-8").replace(/\r/g, "");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`Sem cabeçalho: ${file}`);
  const fm: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const val = (k: string) => (fm[k] && fm[k] !== "None" ? fm[k] : null);
  return {
    slug: fm.slug,
    kind: fm.kind,
    title: fm.title,
    summary: val("summary"),
    tags: (val("tags") || "").split(",").map((t) => t.trim()).filter(Boolean),
    format_slug: val("format_slug"),
    pinned: fm.pinned === "true",
    body: m[2].trim() + "\n",
  };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  let created = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const n = parse(file);
    const exists = await pool.query(`select 1 from edit_notes where slug = $1`, [n.slug]);
    if (exists.rowCount) {
      console.log(`= ${n.slug} (já existe, mantido)`);
      continue;
    }
    const r = await pool.query(
      `insert into edit_notes (slug, kind, title, summary, body_md, tags, format_slug, source, pinned)
       values ($1, $2, $3, $4, $5, $6, $7, 'seed', $8) returning id`,
      [n.slug, n.kind, n.title, n.summary, n.body, n.tags, n.format_slug, n.pinned]
    );
    await pool.query(
      `insert into edit_note_revisions (note_id, title, body_md, changed_by, change_note) values ($1, $2, $3, 'seed', 'conteúdo inicial')`,
      [r.rows[0].id, n.title, n.body]
    );
    created++;
    console.log(`+ ${n.kind}: ${n.slug}`);
  }
  console.log(`\n${created} notas criadas.`);

  // vídeos do perfil → formato (não sobrescreve o que foi corrigido à mão)
  const map = JSON.parse(readFileSync(path.join(dir, "_videos-por-formato.json"), "utf-8")) as Record<string, { slug: string; conf: number; fonte: string }>;
  let linked = 0;
  for (const [videoId, m] of Object.entries(map)) {
    const r = await pool.query(
      `insert into edit_format_videos (video_id, format_slug, confidence, source)
       select $1::uuid, $2, $3, $4 where exists (select 1 from videos where id = $1::uuid)
       on conflict (video_id) do update set format_slug = excluded.format_slug, confidence = excluded.confidence, source = excluded.source, updated_at = now()
       where edit_format_videos.source <> 'manual'`,
      [videoId, m.slug, m.conf, m.fonte]
    );
    linked += r.rowCount ?? 0;
  }
  console.log(`${linked} vídeos ligados a um formato.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
