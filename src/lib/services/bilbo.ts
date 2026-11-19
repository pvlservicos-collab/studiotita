/**
 * Bilbo 🥸 — o agente que vigia os concorrentes do Augusto.
 *
 * Sem IA na seleção: todo dia ele atualiza os posts dos concorrentes vigiados
 * (por padrão, todos os da Concorrência), compara as views de cada post da
 * semana com a mediana do próprio perfil e separa os que mais performaram.
 * Quem escolhe é o Augusto: no botão "Pegar roteiro" o vídeo vai para a análise
 * frame a frame (Gemini) e o roteiro (gancho + estrutura) fica salvo em
 * "Roteiros salvos". Pelo conector, scriptFromPost já devolve o roteiro NOVO
 * do Augusto inspirado no post.
 */
import { put } from "@vercel/blob";
import { query, queryOne } from "@/lib/db";
import { syncCompetitor } from "@/lib/services/competitors";
import { requestAnalysis } from "@/lib/services/analyses";
import { generateScript } from "@/lib/services/scriptGenerator";
import { appUrl } from "@/lib/appUrl";

/** teto de segurança (a Business Discovery da Meta aceita ~200 chamadas por hora) */
export const MAX_WATCH = 50;
/** a varredura para antes do limite de 300s da função; quem sobrar vai primeiro na próxima */
const SCAN_BUDGET_MS = 230_000;
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

/** O Bilbo passa a vigiar todos os concorrentes cadastrados em Concorrência. */
export async function watchAll() {
  await query(
    `insert into bilbo_watch (competitor_id, position)
       select id, (row_number() over (order by followers_count desc nulls last))::int + 100 from competitors
     on conflict (competitor_id) do nothing`
  );
  return listWatched();
}

/** Define quem o Bilbo vigia (@ que precisam estar em Concorrência). */
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
  const started = Date.now();
  // quem está há mais tempo sem atualizar vai primeiro (se o tempo acabar, fica para a próxima)
  const watched = (await listWatched()).sort(
    (a, b) => (a.last_synced_at ? Date.parse(a.last_synced_at) : 0) - (b.last_synced_at ? Date.parse(b.last_synced_at) : 0)
  );
  const report: { username: string; ok: boolean; novos?: number; erro?: string }[] = [];
  const pendentes: string[] = [];
  for (const c of watched) {
    if (Date.now() - started > SCAN_BUDGET_MS) {
      pendentes.push(c.username);
      continue;
    }
    try {
      await syncCompetitor(c.id, 50);
      const comp = await queryOne<{ profile_picture_url: string | null }>(`select profile_picture_url from competitors where id = $1`, [c.id]);
      const avatar = await keepImage(`bilbo/perfil-${c.id}.jpg`, comp?.profile_picture_url ?? null);
      if (avatar) await query(`update bilbo_watch set avatar_blob = $2 where competitor_id = $1`, [c.id, avatar]);

      // capas dos posts recentes (os 9 do mockup) — só as que ainda não foram guardadas
      const recent = await query<{ id: string; thumbnail_url: string | null }>(
        `select id, thumbnail_url from videos where competitor_id = $1 and thumb_blob is null order by posted_at desc limit 9`,
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
  return {
    quando: new Date().toISOString(),
    vigiados: report,
    ...(pendentes.length ? { ficaram_para_a_proxima: pendentes.map((u) => "@" + u) } : {}),
  };
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
  // com muitos vigiados, quem tem o post mais forte da semana aparece primeiro
  const top = (card: { best: { score: number | null }[] }) => (card.best.length ? Math.max(...card.best.map((b) => b.score ?? 0)) : -1);
  cards.sort((a, b) => top(b) - top(a));
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

// ------------------------------------------------------------ em alta na semana
export type TrendingOptions = { days?: number; perProfile?: number; username?: string | null };

/**
 * Os vídeos em alta de TODOS os concorrentes (não só os vigiados), em ranking POR
 * PERFIL: cada concorrente tem a sua lista, com os posts dos últimos `days` dias
 * ordenados por views e comparados com a mediana do próprio perfil. Os perfis não
 * competem entre si (tamanhos de público diferentes). Volta com o link do Instagram
 * e as métricas, prontos para mandar na conversa.
 */
export async function trending(opts: TrendingOptions = {}) {
  const days = Math.min(Math.max(Math.round(opts.days ?? WEEK_DAYS), 1), 60);
  const perProfile = Math.min(Math.max(Math.round(opts.perProfile ?? 3), 1), 20);
  const username = opts.username?.replace(/^@/, "").trim().toLowerCase() || null;

  const rows = await query<{
    video_id: string;
    username: string;
    name: string | null;
    followers_count: number | null;
    permalink: string | null;
    posted_at: string | null;
    views: number | null;
    likes: number | null;
    comments: number | null;
    caption: string | null;
    thumb: string | null;
    median: number | null;
    analysis_status: string | null;
    hook: string | null;
    saved_at: string | null;
  }>(
    `with med as (
       select c.id, c.username, c.name, c.followers_count,
              (select percentile_cont(0.5) within group (order by t.views)
                 from (select views from videos where competitor_id = c.id and views is not null order by posted_at desc limit 30) t) median
         from competitors c
        where $3::text is null or c.username = $3
     )
     , ranked as (
       select v.*, m.username, m.name, m.followers_count, m.median,
              row_number() over (partition by v.competitor_id order by v.views desc) pos
         from videos v join med m on m.id = v.competitor_id
        where v.posted_at >= now() - make_interval(days => $1::int) and coalesce(v.views, 0) > 0
     )
     select r.id video_id, r.username, r.name, r.followers_count, r.permalink, r.posted_at, r.views, r.likes, r.comments,
            left(r.caption, 280) caption, coalesce(r.thumb_blob, r.thumbnail_url) thumb, r.median,
            a.status analysis_status, a.hook, p.saved_at
       from ranked r
       left join bilbo_picks p on p.video_id = r.id
       left join lateral (select status, hook from analyses a where a.video_id = r.id order by (a.status = 'done') desc, a.requested_at desc limit 1) a on true
      where r.pos <= $2
      order by r.followers_count desc nulls last, r.username, r.pos`,
    [days, perProfile, username]
  );
  const allProfiles = await query<{ username: string }>(
    `select username from competitors where $1::text is null or username = $1 order by followers_count desc nulls last`,
    [username]
  );

  const stale = await query<{ username: string }>(
    `select username from competitors
      where (last_synced_at is null or last_synced_at < now() - interval '2 days') and ($1::text is null or username = $1)
      order by username`,
    [username]
  );
  const lastRun = await queryOne<{ created_at: string }>(`select created_at from bilbo_runs order by created_at desc limit 1`);

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const post = (r: (typeof rows)[number], posicao: number) => {
      const median = r.median != null ? Number(r.median) : null;
      const score = median ? (r.views ?? 0) / median : null;
      return {
        posicao,
        video_id: r.video_id,
        instagram: r.permalink,
        publicado_em: r.posted_at,
        legenda: r.caption,
        capa: r.thumb,
        metricas: {
          views: r.views,
          curtidas: r.likes ?? "ocultas pelo perfil",
          comentarios: r.comments,
          // (curtidas + comentários) ÷ views; sem curtidas (perfil esconde) não dá para calcular
          engajamento_pct: r.views && r.likes != null ? round1(((r.likes + (r.comments ?? 0)) / r.views) * 100) : null,
          views_tipicas_do_perfil: median != null ? Math.round(median) : null,
          vezes_o_normal: score != null ? round1(score) : null,
          viralizou: (score ?? 0) >= VIRAL_FACTOR,
        },
        roteiro_do_original:
          r.analysis_status === "done" ? "já extraído" : r.analysis_status === "pending" || r.analysis_status === "processing" ? "extraindo agora" : "ainda não",
        gancho_do_original: r.hook ? r.hook.slice(0, 400) : null,
        salvo_no_bilbo: Boolean(r.saved_at),
      };
  };

  // agrupa por perfil: cada concorrente com o seu próprio ranking
  const perfis = new Map<string, { perfil: string; nome: string | null; seguidores: number | null; views_tipicas_do_perfil: number | null; posts: ReturnType<typeof post>[] }>();
  for (const r of rows) {
    let g = perfis.get(r.username);
    if (!g) {
      g = {
        perfil: `@${r.username}`,
        nome: r.name,
        seguidores: r.followers_count != null ? Number(r.followers_count) : null,
        views_tipicas_do_perfil: r.median != null ? Math.round(Number(r.median)) : null,
        posts: [],
      };
      perfis.set(r.username, g);
    }
    g.posts.push(post(r, g.posts.length + 1));
  }
  const semPosts = allProfiles.filter((p) => !perfis.has(p.username)).map((p) => "@" + p.username);

  return {
    periodo: `últimos ${days} dias`,
    ultima_varredura_do_bilbo: lastRun?.created_at ?? null,
    regra:
      `Ranking POR PERFIL (os perfis não competem entre si): em cada concorrente, os posts do período ordenados por views. ` +
      `vezes_o_normal = views do post ÷ mediana de views dos últimos 30 vídeos do perfil; ${VIRAL_FACTOR}× ou mais = viralizou.`,
    perfis: Array.from(perfis.values()),
    ...(semPosts.length ? { sem_posts_no_periodo: semPosts } : {}),
    ...(stale.length
      ? {
          aviso_dados_antigos: `Estes perfis não são atualizados há mais de 2 dias, então os posts recentes deles podem não aparecer: ${stale
            .map((s) => "@" + s.username)
            .join(", ")}. Rode trending_this_week com refresh=true (ou bilbo_scan) para atualizar.`,
        }
      : {}),
    ver_no_app: `${appUrl()}/bilbo`,
  };
}

// ------------------------------------------------------------ roteiro novo a partir de um post em alta
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Pega um post (em geral, um em alta de concorrente) e devolve o roteiro NOVO do Augusto
 * inspirado nele. Se o roteiro do original ainda não foi extraído, dispara a análise frame a
 * frame e espera até `waitSeconds`; se não ficar pronto a tempo, avisa para chamar de novo.
 */
export async function scriptFromPost(
  videoId: string,
  opts: { subject?: string | null; instructions?: string | null; scenes?: boolean; waitSeconds?: number } = {},
  by = "bilbo"
) {
  const v = await queryOne<{ permalink: string | null; views: number | null; likes: number | null; comments: number | null; username: string | null }>(
    `select v.permalink, v.views, v.likes, v.comments, c.username from videos v left join competitors c on c.id = v.competitor_id where v.id = $1`,
    [videoId]
  );
  if (!v) throw new BilboInputError("Post não encontrado. Use o video_id que vem em trending_this_week ou bilbo_week.");
  const perfil = v.username ? `@${v.username}` : "o próprio Augusto";
  const original = { perfil, instagram: v.permalink, views: v.views, curtidas: v.likes, comentarios: v.comments };

  await pegarRoteiro(videoId, by);
  const latest = () =>
    queryOne<{ status: string; error_message: string | null; hook: string | null; structure: string | null }>(
      `select status, error_message, hook, structure from analyses where video_id = $1 order by (status = 'done') desc, requested_at desc limit 1`,
      [videoId]
    );
  const deadline = Date.now() + Math.min(Math.max(opts.waitSeconds ?? 100, 0), 150) * 1000;
  let a = await latest();
  while (a && (a.status === "pending" || a.status === "processing") && Date.now() < deadline) {
    await sleep(4000);
    a = await latest();
  }
  if (!a || a.status === "error") {
    throw new BilboInputError(
      `Não consegui extrair o roteiro do vídeo original (${perfil}): ${a?.error_message ?? "a análise não começou"}. ` +
        `Se for música licenciada, o Augusto pode baixar o vídeo e enviar pelo painel; se forem os créditos do Gemini, recarregue em aistudio.google.com.`
    );
  }
  if (a.status !== "done") {
    return {
      status: "extraindo",
      original,
      mensagem:
        "O Gemini ainda está extraindo o roteiro do vídeo original (às vezes leva 2 a 3 minutos). Chame script_from_trending de novo com o mesmo video_id em cerca de 1 minuto: o roteiro novo sai na hora.",
    };
  }

  const adapt = [
    `Este roteiro é uma ADAPTAÇÃO para o Augusto de um vídeo que está em alta${v.username ? ` no perfil @${v.username}` : ""} (${v.views ?? "?"} views).`,
    "Mantenha o que fez o vídeo performar (o tipo de gancho, o arco da narrativa, o ritmo e os gatilhos), mas com o tema, as ideias, o método e a voz do Augusto. Não copie frases do original.",
    opts.instructions?.trim() ?? "",
  ]
    .filter(Boolean)
    .join("\n");
  const script = await generateScript({ videoIds: [videoId], subject: opts.subject ?? null, instructions: adapt, scenes: Boolean(opts.scenes) }, by);
  return {
    status: "pronto",
    original: { ...original, gancho: a.hook, estrutura: a.structure },
    roteiro_novo: {
      id: script.id,
      titulo: script.title,
      gancho: script.hook,
      estrutura: script.structure,
      roteiro_completo: script.full_script,
      ...(script.scenes ? { cenas_estudio_reels: script.scenes } : {}),
    },
    ver_no_app: `${appUrl()}/roteiros`,
  };
}
