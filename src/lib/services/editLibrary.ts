/**
 * Biblioteca de Edição do Titã — a memória online de como os vídeos do
 * Augusto são editados. Notas em Markdown estilo Obsidian: [[slug]] liga uma
 * nota a outra e a página mostra os backlinks. Todo Claude conectado pelo MCP
 * lê daqui antes de editar e grava aqui cada preferência nova do Augusto.
 */
import { query, queryOne } from "@/lib/db";
import { analyzeEditStyleWithGemini, classifyImagesWithGemini } from "@/lib/gemini";
import { put } from "@vercel/blob";
import { metaGraphRequest } from "@/lib/meta";
import { syncVideosFromMeta } from "@/lib/services/videos";

export const EDIT_KINDS = ["formato", "regra", "referencia", "guia"] as const;
export type EditKind = (typeof EDIT_KINDS)[number];

export interface EditNote {
  id: string;
  slug: string;
  kind: EditKind;
  title: string;
  summary: string | null;
  body_md: string;
  tags: string[];
  format_slug: string | null;
  media_url: string | null;
  source: string | null;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export class EditNoteNotFound extends Error {}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "nota";
}

/** [[slug]] ou [[slug|texto]] dentro do Markdown. */
export function extractLinks(md: string): string[] {
  const out = new Set<string>();
  for (const m of md.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) out.add(slugify(m[1]));
  return [...out];
}

async function uniqueSlug(base: string) {
  let slug = slugify(base);
  let n = 2;
  while (await queryOne(`select 1 from edit_notes where slug = $1`, [slug])) slug = `${slugify(base)}-${n++}`;
  return slug;
}

export async function listEditNotes(opts: { kind?: EditKind; format_slug?: string; search?: string; includeArchived?: boolean } = {}) {
  const where: string[] = [];
  const params: any[] = [];
  if (!opts.includeArchived) where.push("archived = false");
  if (opts.kind) {
    params.push(opts.kind);
    where.push(`kind = $${params.length}`);
  }
  if (opts.format_slug) {
    params.push(opts.format_slug);
    where.push(`(format_slug = $${params.length} or slug = $${params.length})`);
  }
  if (opts.search) {
    params.push(`%${opts.search}%`);
    where.push(`(title ilike $${params.length} or body_md ilike $${params.length} or summary ilike $${params.length} or array_to_string(tags, ' ') ilike $${params.length})`);
  }
  return query<EditNote>(
    `select * from edit_notes ${where.length ? "where " + where.join(" and ") : ""}
     order by pinned desc, case kind when 'formato' then 0 when 'guia' then 1 when 'regra' then 2 else 3 end, updated_at desc`,
    params
  );
}

export async function getEditNote(slugOrId: string) {
  const note = await queryOne<EditNote>(`select * from edit_notes where slug = $1 or id::text = $1`, [slugOrId]);
  if (!note) throw new EditNoteNotFound(`Nota "${slugOrId}" não existe na Biblioteca de Edição. Use list_edit_library para ver os slugs.`);
  const backlinks = await query<Pick<EditNote, "slug" | "title" | "kind">>(
    `select slug, title, kind from edit_notes where archived = false and slug <> $1 and (body_md ilike $2 or format_slug = $1)
     order by kind, title`,
    [note.slug, `%[[${note.slug}%`]
  );
  const rules =
    note.kind === "formato"
      ? await query<EditNote>(`select * from edit_notes where kind = 'regra' and archived = false and (format_slug = $1 or format_slug is null) order by format_slug nulls first, created_at`, [note.slug])
      : [];
  const revisions = await query<{ id: string; changed_by: string | null; change_note: string | null; created_at: string }>(
    `select id, changed_by, change_note, created_at from edit_note_revisions where note_id = $1 order by created_at desc limit 30`,
    [note.id]
  );
  return { ...note, links: extractLinks(note.body_md), backlinks, rules, revisions };
}

async function addRevision(noteId: string, title: string, body: string, by: string, why: string) {
  await query(`insert into edit_note_revisions (note_id, title, body_md, changed_by, change_note) values ($1, $2, $3, $4, $5)`, [noteId, title, body, by, why]);
}

export async function createEditNote(
  input: { kind: EditKind; title: string; body_md?: string; summary?: string; tags?: string[]; format_slug?: string | null; media_url?: string | null; slug?: string; pinned?: boolean },
  by = "painel",
  why = "criada"
) {
  const slug = await uniqueSlug(input.slug || input.title);
  const note = await queryOne<EditNote>(
    `insert into edit_notes (slug, kind, title, summary, body_md, tags, format_slug, media_url, source, pinned)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
    [slug, input.kind, input.title, input.summary ?? null, input.body_md ?? "", input.tags ?? [], input.format_slug ?? null, input.media_url ?? null, by, input.pinned ?? false]
  );
  await addRevision(note!.id, note!.title, note!.body_md, by, why);
  return note!;
}

export async function updateEditNote(
  slugOrId: string,
  patch: Partial<Pick<EditNote, "title" | "summary" | "body_md" | "tags" | "format_slug" | "media_url" | "pinned" | "archived" | "kind">>,
  by = "painel",
  why = "editada"
) {
  const cur = await queryOne<EditNote>(`select * from edit_notes where slug = $1 or id::text = $1`, [slugOrId]);
  if (!cur) throw new EditNoteNotFound(`Nota "${slugOrId}" não existe.`);
  const next = { ...cur, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } as EditNote;
  const note = await queryOne<EditNote>(
    `update edit_notes set title=$2, summary=$3, body_md=$4, tags=$5, format_slug=$6, media_url=$7, pinned=$8, archived=$9, kind=$10, updated_at=now()
     where id=$1 returning *`,
    [cur.id, next.title, next.summary, next.body_md, next.tags, next.format_slug, next.media_url, next.pinned, next.archived, next.kind]
  );
  await addRevision(cur.id, next.title, next.body_md, by, why);
  return note!;
}

/** Acrescenta um trecho ao fim de uma nota (sem reescrever o resto). */
export async function appendToEditNote(slugOrId: string, markdown: string, by: string, why: string) {
  const cur = await queryOne<EditNote>(`select * from edit_notes where slug = $1 or id::text = $1`, [slugOrId]);
  if (!cur) throw new EditNoteNotFound(`Nota "${slugOrId}" não existe.`);
  return updateEditNote(cur.id, { body_md: `${cur.body_md.trimEnd()}\n\n${markdown.trim()}\n` }, by, why);
}

/**
 * Preferência nova do Augusto ("eu sempre olho pra baixo pra ler, corta essa parte").
 * Vira uma nota de regra, ligada ao formato (ou a todos), com o pedido original guardado.
 */
export async function saveEditPreference(
  input: { rule: string; title?: string; format_slug?: string | null; original_request?: string; why?: string; tags?: string[] },
  by: string
) {
  if (input.format_slug) {
    const f = await queryOne(`select 1 from edit_notes where slug = $1 and kind = 'formato'`, [input.format_slug]);
    if (!f) throw new EditNoteNotFound(`Formato "${input.format_slug}" não existe. Use list_edit_library(kind="formato") ou deixe vazio para valer em todos os formatos.`);
  }
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());
  const title = input.title?.trim() || input.rule.split(/[.!\n]/)[0].slice(0, 70);
  const body = [
    `**Regra:** ${input.rule.trim()}`,
    input.why ? `\n**Por quê:** ${input.why.trim()}` : "",
    `\n**Vale para:** ${input.format_slug ? `[[${input.format_slug}]]` : "todos os formatos"}`,
    input.original_request ? `\n> Pedido original do Augusto (${date}): "${input.original_request.trim()}"` : `\n_Registrada em ${date} por ${by}._`,
  ].join("\n");
  return createEditNote({ kind: "regra", title, body_md: body, format_slug: input.format_slug ?? null, tags: input.tags ?? [] }, by, "preferência do Augusto");
}

/** Edição de concorrente → Gemini → nota de referência com ficha + prompt pronto. */
export async function learnCompetitorEdit(input: { media_url: string; title?: string; competitor?: string; notes?: string }, by: string) {
  const r = await analyzeEditStyleWithGemini(input.media_url, input.notes);
  const title = input.title?.trim() || (input.competitor ? `${r.titulo} (${input.competitor})` : r.titulo);
  const body = [
    r.resumo,
    input.competitor ? `\n**Concorrente:** ${input.competitor}` : "",
    `\n**Material:** ${input.media_url}`,
    `\n## Prompt pronto para editar no mesmo estilo\n\n\`\`\`prompt\n${r.prompt}\n\`\`\``,
    `\n## Ficha da edição\n\n${r.ficha}`,
    `\n_Gerado pelo ${r.model}. Para virar padrão do Titã, crie um formato a partir desta referência ou salve as partes que o Augusto aprovar como regra._`,
  ].join("\n");
  return createEditNote({ kind: "referencia", title, summary: r.resumo, body_md: body, tags: r.tags, media_url: input.media_url }, by, "aprendida do concorrente pelo Gemini");
}

/** Índice compacto para o Claude: o que existe e onde está. */
export async function editLibraryIndex() {
  const notes = await listEditNotes();
  const by = (k: EditKind) => notes.filter((n) => n.kind === k).map((n) => ({ slug: n.slug, title: n.title, summary: n.summary, format_slug: n.format_slug, updated_at: n.updated_at }));
  return { formatos: by("formato"), guias: by("guia"), regras: by("regra"), referencias: by("referencia") };
}

/** Tudo o que um Claude precisa para editar um vídeo num formato: ficha + regras + guias, numa string só. */
export async function editBriefing(formatSlug: string) {
  const f = await getEditNote(formatSlug);
  if (f.kind !== "formato") throw new EditNoteNotFound(`"${formatSlug}" não é um formato.`);
  const guias = await listEditNotes({ kind: "guia" });
  const linked = await query<EditNote>(`select * from edit_notes where archived = false and slug = any($1) and kind <> 'regra'`, [f.links]);
  const [m] = await formatMetrics(formatSlug).catch(() => []);
  const metricas = m
    ? `
## Desempenho deste formato no perfil
${m.videos} vídeos · média de ${m.avg_views ?? "—"} views (mediana ${m.median_views ?? "—"}) · ${m.avg_saves ?? "—"} salvamentos · ${m.avg_shares ?? "—"} compartilhamentos · engajamento ${m.engagement_rate ?? "—"}%
Melhores: ${m.top.map((t) => `${t.permalink} (${t.views} views)`).join(" · ")}`
    : "";
  return [
    `# BRIEFING DE EDIÇÃO — ${f.title}`,
    metricas,
    `Leia tudo antes de editar. As REGRAS valem acima da ficha (são correções mais recentes do Augusto).`,
    `\n## Ficha do formato\n\n${f.body_md}`,
    `\n## Regras (${f.rules.length})\n\n${f.rules.map((r, i) => `${i + 1}. **${r.title}**${r.format_slug ? "" : " _(todos os formatos)_"}\n${r.body_md}`).join("\n\n") || "Nenhuma ainda."}`,
    `\n## Guias gerais\n\n${guias.map((g) => `### ${g.title}\n${g.body_md}`).join("\n\n")}`,
    linked.length ? `\n## Notas ligadas\n\n${linked.filter((n) => n.kind !== "guia").map((n) => `### ${n.title}\n${n.body_md}`).join("\n\n")}` : "",
  ].join("\n");
}

// ------------------------------------------------------------------ métricas
export interface FormatMetrics {
  format_slug: string;
  videos: number;
  avg_views: number | null;
  median_views: number | null;
  avg_reach: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  avg_saves: number | null;
  avg_shares: number | null;
  engagement_rate: number | null; // (curtidas+comentários+salvamentos+compartilhamentos) / alcance
  last_posted_at: string | null;
  total_views: number | null;
  top: { id: string; caption: string | null; permalink: string | null; views: number | null; saves: number | null; posted_at: string | null; thumb_url: string | null }[];
}

/** Desempenho de cada formato de edição, com os números da Meta dos vídeos do Augusto. */
export async function formatMetrics(slug?: string): Promise<FormatMetrics[]> {
  const rows = await query<Omit<FormatMetrics, "top">>(
    `select f.format_slug, count(*)::int videos,
            round(avg(v.views))::int avg_views,
            round(percentile_cont(0.5) within group (order by v.views))::int median_views,
            round(avg(v.reach))::int avg_reach, round(avg(v.likes))::int avg_likes, round(avg(v.comments))::int avg_comments,
            round(avg(v.saves))::int avg_saves, round(avg(v.shares))::int avg_shares,
            round((sum(coalesce(v.likes,0)+coalesce(v.comments,0)+coalesce(v.saves,0)+coalesce(v.shares,0))::numeric / nullif(sum(v.reach),0)) * 100, 2)::float engagement_rate,
            max(v.posted_at) last_posted_at, sum(v.views)::bigint total_views
       from edit_format_videos f join videos v on v.id = f.video_id
      where ($1::text is null or f.format_slug = $1)
      group by f.format_slug order by avg(v.views) desc nulls last`,
    [slug ?? null]
  );
  const top = await query<{ format_slug: string } & FormatMetrics["top"][number]>(
    `select * from (
       select f.format_slug, v.id, left(v.caption, 120) caption, v.permalink, v.views, v.saves, v.posted_at, f.thumb_url,
              row_number() over (partition by f.format_slug order by (f.thumb_url is not null) desc, v.views desc nulls last) rn
         from edit_format_videos f join videos v on v.id = f.video_id
        where ($1::text is null or f.format_slug = $1)) t where rn <= 6`,
    [slug ?? null]
  );
  return rows.map((r) => ({ ...r, top: top.filter((t) => t.format_slug === r.format_slug).map(({ format_slug: _f, ...t }) => t) }));
}

export async function setVideoFormat(videoId: string, formatSlug: string) {
  await query(
    `insert into edit_format_videos (video_id, format_slug, confidence, source) values ($1, $2, 1, 'manual')
     on conflict (video_id) do update set format_slug = excluded.format_slug, confidence = 1, source = 'manual', updated_at = now()`,
    [videoId, formatSlug]
  );
}

// ------------------------------------------------- capas e vídeos novos
const isImage = (b: Buffer) => (b[0] === 0xff && b[1] === 0xd8) || b.subarray(1, 4).toString() === "PNG" || b.subarray(8, 12).toString() === "WEBP";

/** Baixa a capa atual do Reel (link novo pela Meta: o salvo no banco expira). */
async function fetchThumb(video: { ig_media_id: string | null; thumbnail_url: string | null }): Promise<Buffer | null> {
  let url = video.thumbnail_url;
  if (video.ig_media_id) {
    try {
      const m: any = await metaGraphRequest("GET", `/${video.ig_media_id}`, { fields: "thumbnail_url,media_url" });
      url = m?.thumbnail_url || url;
    } catch {
      /* usa a que tiver */
    }
  }
  if (!url) return null;
  try {
    const r = await fetch(url);
    const b = Buffer.from(await r.arrayBuffer());
    return r.ok && isImage(b) ? b : null;
  } catch {
    return null;
  }
}

async function storeThumb(videoId: string, img: Buffer) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const r = await put(`capas-reels/${videoId}.jpg`, img, { access: "public", token: process.env.BLOB_READ_WRITE_TOKEN, addRandomSuffix: false, contentType: "image/jpeg" });
  return r.url;
}

/** Guarda cópia permanente da capa dos vídeos que ainda não têm. */
export async function backfillThumbs(limit = 60) {
  const rows = await query<{ id: string; ig_media_id: string | null; thumbnail_url: string | null }>(
    `select v.id, v.ig_media_id, v.thumbnail_url from edit_format_videos f join videos v on v.id = f.video_id where f.thumb_url is null order by v.views desc nulls last limit $1`,
    [limit]
  );
  let ok = 0;
  for (const v of rows) {
    const img = await fetchThumb(v);
    const url = img ? await storeThumb(v.id, img).catch(() => null) : null;
    if (url) {
      await query(`update edit_format_videos set thumb_url = $2 where video_id = $1`, [v.id, url]);
      ok++;
    }
  }
  return { pendentes: rows.length, salvas: ok };
}

/** Vídeos novos do Augusto ainda sem formato: o Gemini olha a capa e classifica. */
export async function classifyNewVideos(limit = 40) {
  const formats = await listEditNotes({ kind: "formato" });
  const recog = formats
    .map((f) => {
      const m = f.body_md.match(/## Como reconhecer pela capa\n([\s\S]*?)(\n#|\n\nIdentidade|$)/);
      return `- ${f.slug}: ${f.title}. ${m ? m[1].trim() : f.summary ?? ""}`;
    })
    .join("\n");
  const vids = await query<{ id: string; ig_media_id: string | null; thumbnail_url: string | null; caption: string | null }>(
    `select v.id, v.ig_media_id, v.thumbnail_url, v.caption from videos v
      where v.competitor_id is null and v.hashtag is null and not exists (select 1 from edit_format_videos f where f.video_id = v.id)
      order by v.posted_at desc nulls last limit $1`,
    [limit]
  );
  const imgs: { v: (typeof vids)[number]; img: Buffer }[] = [];
  for (const v of vids) {
    const img = await fetchThumb(v);
    if (img) imgs.push({ v, img });
  }
  let classified = 0;
  for (let i = 0; i < imgs.length; i += 12) {
    const batch = imgs.slice(i, i + 12);
    const res = await classifyImagesWithGemini<{ id: string; slug: string; conf: number }[]>(
      `Formatos de edição do criador:\n${recog}\n- outros: nenhum dos anteriores.\n\nClassifique cada capa de Reel abaixo (precedida do ID e do começo da legenda) no slug mais provável. Responda só JSON: [{"id":"","slug":"","conf":0.0}]`,
      batch.map(({ v, img }) => ({ label: `ID ${v.id} | legenda: ${(v.caption ?? "").slice(0, 160)}`, data: img, mime: "image/jpeg" }))
    );
    for (const r of res) {
      const item = batch.find((b) => b.v.id === r.id);
      if (!item) continue;
      const url = await storeThumb(item.v.id, item.img).catch(() => null);
      await query(
        `insert into edit_format_videos (video_id, format_slug, confidence, source, thumb_url) values ($1, $2, $3, 'capa', $4) on conflict (video_id) do nothing`,
        [item.v.id, r.slug, r.conf ?? 0.5, url]
      );
      classified++;
    }
  }
  return { novos: classified };
}

/** Rotina diária: Reels novos da Meta (e números atualizados) → formato → capa. */
export async function refreshFormatMetrics() {
  const sync = await syncVideosFromMeta(50).then(() => "ok").catch((e: Error) => `falhou: ${e.message}`);
  const classified = await classifyNewVideos(40);
  const thumbs = await backfillThumbs(60);
  return { sync_meta: sync, ...classified, capas: thumbs };
}

/** Prompt para colar no Claude: editar um vídeo neste formato, com o briefing inteiro embutido. */
export async function buildFormatPrompt(formatSlug: string) {
  const f = await getEditNote(formatSlug);
  const briefing = await editBriefing(formatSlug);
  return `Você é o editor de vídeo do Augusto Weber (@augustotita, "Titã"). Vou te mandar um vídeo bruto e você vai editá-lo no formato "${f.title}" — exatamente como os Reels dele que já deram certo neste formato.

Como trabalhar:
1. Se você tem o conector "Studio Titã", chame get_edit_briefing("${f.slug}") para pegar a versão mais atual deste briefing antes de começar.
2. Siga a ficha do formato; as REGRAS valem acima da ficha.
3. Sempre que eu pedir uma mudança que deve valer daqui pra frente, salve com save_edit_preference (se tiver o conector) ou me devolva a regra escrita para eu guardar.
4. Ao terminar, me diga o que fez em cada etapa e o que precisa da minha aprovação.

${briefing}`;
}
