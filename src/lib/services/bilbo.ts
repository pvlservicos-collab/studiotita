/**
 * Bilbo 🥸 — o agente que vigia os concorrentes do Augusto.
 *
 * Sem IA na seleção: todo dia ele atualiza os posts dos concorrentes vigiados
 * (até 3), compara as views de cada post da semana com a mediana do próprio
 * perfil e separa os que mais performaram. Quem escolhe é o Augusto: no botão
 * "Pegar roteiro" o vídeo vai para a análise frame a frame (Gemini) e o
 * roteiro (gancho + estrutura) fica salvo em "Roteiros salvos".
 */
import { put } from "@vercel/blob";
import { query, queryOne } from "@/lib/db";
import { syncCompetitor } from "@/lib/services/competitors";
import { requestAnalysis } from "@/lib/services/analyses";

export const MAX_WATCH = 3;
const WEEK_DAYS = 7;
const PICKS_PER_COMPETITOR = 3;
/** a partir de quantas vezes a mediana do perfil o post conta como "viralizou" */
export const VIRAL_FACTOR = 2;

export class BilboInputError extends Error {}

// ------------------------------------------------------------ imagens
const isImage = (b: Buffer) => (b[0] === 0xff && b[1] === 0xd8) || b.subarray(1, 4).toString() === "PNG" || b.subarray(8, 12).toString() === "WEBP";

/** Copia uma imagem da CDN da Meta (que expira) para o Blob. */
async function keepImage(path: string, url: string | null): Promise<string | null> {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const r = await fetch(url);
    const b = Buffer.from(await r.arrayBuffer());
    if (!r.ok || !isImage(b)) return null;
    const out = await put(path, b, { access: "public", token: process.env.BLOB_READ_WRITE_TOKEN, addRandomSuffix: false, contentType: "image/jpeg" });
    return out.url;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ vigiados
export async function listWatched() {
  return query<{ id: string; username: string; name: string | null; followers_count: number | null; media_count: number | null; biography: string | null; avatar_url: string | null; last_synced_at: string | null; position: number }>(
    `select c.id, c.username, c.name, c.followers_count, c.media_count, c.biography, c.last_synced_at, w.position,
            coalesce(w.avatar_blob, c.profile_picture_url) avatar_url
       from bilbo_watch w join competitors c on c.id = w.competitor_id order by w.position, c.username`
  );
}

/** Define quem o Bilbo vigia (até 3 @, que precisam estar em Concorrência). */
export async function setWatched(usernames: string[]) {
  const clean = [...new Set(usernames.map((u) => u.replace(/^@/, "").trim().toLowerCase()).filter(Boolean))];
  if (clean.length > MAX_WATCH) throw new BilboInputError(`O Bilbo vigia no máximo ${MAX_WATCH} concorrentes.`);
  const rows = await query<{ id: string; username: string }>(`select id, username from competitors where username = any($1)`, [clean]);
  const missing = clean.filter((u) => !rows.some((r) => r.username === u));
  if (missing.length) throw new BilboInputError(`Não estão em Concorrência: ${missing.map((m) => "@" + m).join(", ")}. Adicione antes (add_competitors).`);
  await query(`delete from bilbo_watch where competitor_id <> all($1::uuid[])`, [rows.map((r) => r.id)]);
  for (const [i, u] of clean.entries()) {
    const r = rows.find((x) => x.username === u)!;
    await query(`insert into bilbo_watch (competitor_id, position) values ($1, $2) on conflict (competitor_id) do update set position = excluded.position`, [r.id, i]);
  }
  return listWatched();
}

// ------------------------------------------------------------ varredura
/** Mediana de views dos últimos 30 vídeos do perfil (a régua do "performou bem"). */
async function medianViews(competitorId: string) {
  const r = await queryOne<{ m: number | null }>(
    `select percentile_cont(0.5) within group (order by views) m from (
       select views from videos where competitor_id = $1 and views is not null order by posted_at desc limit 30) t`,
    [competitorId]
  );
  return r?.m ?? null;
}

/**
 * Atualiza os posts dos vigiados, guarda capas e foto de perfil e separa os
 * melhores da semana. Posts novos entram como "não vistos" (bolinha no menu).
 */
export async function scan() {
  const watched = await listWatched();
  const report: { username: string; ok: boolean; novos?: number; erro?: string }[] = [];
  for (const c of watched) {
    try {
      await syncCompetitor(c.id, 50);
      const comp = await queryOne<{ profile_picture_url: string | null }>(`select profile_picture_url from competitors where id = $1`, [c.id]);
      const avatar = await keepImage(`bilbo/perfil-${c.id}.jpg`, comp?.profile_picture_url ?? null);
      if (avatar) await query(`update bilbo_watch set avatar_blob = $2 where competitor_id = $1`, [c.id, avatar]);

      // capas dos posts recentes (mockup) — só as que ainda não foram guardadas
      const recent = await query<{ id: string; thumbnail_url: string | null }>(
        `select id, thumbnail_url from videos where competitor_id = $1 and thumb_blob is null order by posted_at desc limit 15`,
        [c.id]
      );
      for (const v of recent) {
        const url = await keepImage(`bilbo/capa-${v.id}.jpg`, v.thumbnail_url);
        if (url) await query(`update videos set thumb_blob = $2 where id = $1`, [v.id, url]);
      }

      const median = await medianViews(c.id);
      const week = await query<{ id: string; views: number | null }>(
        `select id, views from videos where competitor_id = $1 and posted_at >= now() - interval '${WEEK_DAYS} days' and coalesce(views, 0) > 0
          order by views desc limit ${PICKS_PER_COMPETITOR}`,
        [c.id]
      );
      let novos = 0;
      for (const v of week) {
        const score = median ? (v.views ?? 0) / median : null;
        const r = await query(
          `insert into bilbo_picks (video_id, competitor_id, score) values ($1, $2, $3)
           on conflict (video_id) do update set score = excluded.score returning (xmax = 0) as inserted`,
          [v.id, c.id, score]
        );
        if ((r[0] as any)?.inserted) novos++;
      }
      report.push({ username: c.username, ok: true, novos });
    } catch (err) {
      report.push({ username: c.username, ok: false, erro: (err as Error).message });
    }
  }
  await query(`insert into bilbo_runs (report) values ($1)`, [JSON.stringify(report)]);
  return { quando: new Date().toISOString(), vigiados: report };
}

// ------------------------------------------------------------ leitura
export async function unseenCount() {
  const r = await queryOne<{ n: number }>(
    `select count(*)::int n from bilbo_picks p join bilbo_watch w on w.competitor_id = p.competitor_id where not p.seen`
  );
  return r?.n ?? 0;
}

export async function markAllSeen() {
  await query(`update bilbo_picks set seen = true where not seen`);
}

type PostRow = {
  id: string;
  caption: string | null;
  permalink: string | null;
  posted_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  thumb: string | null;
};

/** Tudo da aba "Virais da semana": por concorrente, o perfil, os posts recentes e os melhores da semana. */
export async function overview() {
  const watched = await listWatched();
  const lastRun = await queryOne<{ created_at: string }>(`select created_at from bilbo_runs order by created_at desc limit 1`);
  const cards = [];
  for (const c of watched) {
    const median = await medianViews(c.id);
    const recent = await query<PostRow>(
      `select id, left(caption, 200) caption, permalink, posted_at, views, likes, comments, coalesce(thumb_blob, thumbnail_url) thumb
         from videos where competitor_id = $1 order by posted_at desc limit 9`,
      [c.id]
    );
    const best = await query<PostRow & { score: number | null; seen: boolean; saved_at: string | null; analysis_status: string | null }>(
      `select v.id, left(v.caption, 200) caption, v.permalink, v.posted_at, v.views, v.likes, v.comments, coalesce(v.thumb_blob, v.thumbnail_url) thumb,
              p.score, p.seen, p.saved_at,
              (select a.status from analyses a where a.video_id = v.id order by a.requested_at desc limit 1) analysis_status
         from bilbo_picks p join videos v on v.id = p.video_id
        where p.competitor_id = $1 and v.posted_at >= now() - interval '${WEEK_DAYS} days'
        order by p.score desc nulls last, v.views desc nulls last`,
      [c.id]
    );
    cards.push({ competitor: c, median_views: median, recent, best: best.map((b) => ({ ...b, viral: (b.score ?? 0) >= VIRAL_FACTOR })) });
  }
  return { last_scan_at: lastRun?.created_at ?? null, viral_factor: VIRAL_FACTOR, unseen: await unseenCount(), cards };
}

// ------------------------------------------------------------ pegar roteiro
/**
 * "Pegar roteiro": marca o post como salvo e manda o vídeo para a análise frame a
 * frame do Gemini (se ainda não tiver uma pronta). O roteiro aparece em Roteiros salvos.
 */
export async function pegarRoteiro(videoId: string, by = "bilbo") {
  const v = await queryOne<{ id: string; competitor_id: string | null }>(`select id, competitor_id from videos where id = $1`, [videoId]);
  if (!v) throw new BilboInputError("Post não encontrado.");
  await query(
    `insert into bilbo_picks (video_id, competitor_id, seen, saved_at) values ($1, $2, true, now())
     on conflict (video_id) do update set saved_at = coalesce(bilbo_picks.saved_at, now()), seen = true`,
    [v.id, v.competitor_id]
  );
  const ok = await queryOne<{ id: string; status: string }>(
    `select id, status from analyses where video_id = $1 and status in ('done', 'pending', 'processing') order by requested_at desc limit 1`,
    [videoId]
  );
  if (ok) return { video_id: videoId, analysis_id: ok.id, status: ok.status };
  const a = await requestAnalysis(videoId, by, null, false);
  return { video_id: videoId, analysis_id: a.id, status: a.status };
}

/** Aba "Roteiros salvos": o post e o roteiro (gancho e estrutura) de cada um que o Augusto pegou. */
export async function savedScripts() {
  return query<{
    video_id: string;
    username: string | null;
    caption: string | null;
    permalink: string | null;
    posted_at: string | null;
    views: number | null;
    likes: number | null;
    comments: number | null;
    thumb: string | null;
    score: number | null;
    saved_at: string;
    analysis_status: string | null;
    analysis_error: string | null;
    hook: string | null;
    structure: string | null;
  }>(
    `select v.id video_id, c.username, v.caption, v.permalink, v.posted_at, v.views, v.likes, v.comments, coalesce(v.thumb_blob, v.thumbnail_url) thumb,
            p.score, p.saved_at, a.status analysis_status, a.error_message analysis_error, a.hook, a.structure
       from bilbo_picks p
       join videos v on v.id = p.video_id
       left join competitors c on c.id = p.competitor_id
       left join lateral (select * from analyses a where a.video_id = v.id order by (a.status = 'done') desc, a.requested_at desc limit 1) a on true
      where p.saved_at is not null
      order by p.saved_at desc`
  );
}

export async function removeSaved(videoId: string) {
  await query(`update bilbo_picks set saved_at = null where video_id = $1`, [videoId]);
}
