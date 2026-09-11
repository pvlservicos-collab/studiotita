import { query, queryOne } from "@/lib/db";
import type { VideoRow } from "@/lib/types";
import { fetchRecentMedia, fetchMediaInsights } from "@/lib/meta";

const SELECT_VIDEOS = `
  select v.*,
         c.username   as competitor_username,
         la.id        as latest_analysis_id,
         la.status    as latest_analysis_status,
         la.summary   as latest_analysis_summary,
         ld.categories as latest_analysis_categories,
         (ld.frames is not null and ld.frames <> '') as latest_analysis_has_frames
  from videos v
  left join competitors c on c.id = v.competitor_id
  left join lateral (
    select id, status, summary from analyses a
    where a.video_id = v.id order by a.requested_at desc limit 1
  ) la on true
  left join lateral (
    select categories, frames from analyses a
    where a.video_id = v.id and a.status = 'done' order by a.requested_at desc limit 1
  ) ld on true`;

export interface VideoFilter {
  /** own = Augusto (padrão); competitor = de um concorrente; hashtag = de uma hashtag; all = tudo */
  scope?: "own" | "competitor" | "hashtag" | "all";
  competitorId?: string;
  hashtag?: string;
  /** procura na legenda, na transcrição e nas categorias que o Gemini gerou */
  search?: string;
}

export async function listVideos(filter: VideoFilter = {}): Promise<VideoRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const scope = filter.scope ?? "own";
  if (scope === "own") where.push(`v.competitor_id is null and v.source in ('meta', 'manual', 'claude_code')`);
  if (scope === "competitor") {
    where.push(`v.source = 'competitor'`);
    if (filter.competitorId) {
      params.push(filter.competitorId);
      where.push(`v.competitor_id = $${params.length}`);
    }
  }
  if (scope === "hashtag") {
    where.push(`v.hashtag is not null`);
    if (filter.hashtag) {
      params.push(filter.hashtag);
      where.push(`v.hashtag = $${params.length}`);
    }
  }
  if (filter.search?.trim()) {
    params.push(`%${filter.search.trim()}%`);
    where.push(
      `(v.caption ilike $${params.length} or exists (
         select 1 from analyses a where a.video_id = v.id and a.status = 'done'
         and (a.transcript ilike $${params.length} or a.summary ilike $${params.length}
              or array_to_string(a.categories, ' ') ilike $${params.length})))`
    );
  }
  return query<VideoRow>(
    `${SELECT_VIDEOS} ${where.length ? `where ${where.join(" and ")}` : ""}
     order by coalesce(v.posted_at, v.created_at) desc`,
    params
  );
}

export async function getVideo(id: string): Promise<VideoRow | null> {
  return queryOne<VideoRow>(`${SELECT_VIDEOS} where v.id = $1`, [id]);
}

/** Cópia própria do arquivo (quando a Meta não libera o vídeo de outra conta). */
export async function setVideoBlob(id: string, blobUrl: string): Promise<VideoRow | null> {
  await query(`update videos set blob_url = $2 where id = $1`, [id, blobUrl]);
  return getVideo(id);
}

export interface CreateVideoInput {
  caption?: string;
  video_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  posted_at?: string;
  source?: "manual" | "claude_code";
}

export async function createVideo(input: CreateVideoInput): Promise<VideoRow> {
  const row = await queryOne<VideoRow>(
    `insert into videos (caption, video_url, thumbnail_url, permalink, posted_at, source)
     values ($1, $2, $3, $4, coalesce($5::timestamptz, now()), $6)
     returning *`,
    [
      input.caption ?? null,
      input.video_url ?? null,
      input.thumbnail_url ?? null,
      input.permalink ?? null,
      input.posted_at ?? null,
      input.source ?? "manual",
    ]
  );
  if (!row) throw new Error("Falha ao criar vídeo.");
  return row;
}

/**
 * Busca os vídeos recentes na Meta Graph API e faz upsert em `videos`,
 * incluindo todas as métricas da mídia (colunas principais + `metrics`).
 */
export async function syncVideosFromMeta(limit = 25) {
  const media = (await fetchRecentMedia(limit)).filter(
    (item) => item.media_type === "VIDEO" || item.media_type === "REELS"
  );
  let created = 0;
  let updated = 0;

  // Métricas em lotes paralelos: com 100+ vídeos, uma a uma estoura o tempo da função.
  const insightsById: Record<string, Record<string, number>> = {};
  for (let i = 0; i < media.length; i += 8) {
    await Promise.all(
      media.slice(i, i + 8).map(async (item) => {
        try {
          insightsById[item.id] = await fetchMediaInsights(item.id, item.media_product_type);
        } catch (err) {
          // Alguns tipos de mídia não têm todas as métricas — segue sem travar o sync.
          console.warn(`Insights indisponíveis para a mídia ${item.id}:`, (err as Error).message);
        }
      })
    );
  }

  for (const item of media) {
    const insights = insightsById[item.id] ?? {};
    const mediaType = item.media_product_type === "REELS" ? "REELS" : item.media_type;
    const metrics = [
      insights.views ?? 0,
      insights.likes ?? 0,
      insights.comments ?? 0,
      insights.shares ?? 0,
      insights.saved ?? 0,
      insights.reach ?? 0,
    ];

    const existing = await queryOne<{ id: string }>(
      `select id from videos where ig_media_id = $1`,
      [item.id]
    );

    if (existing) {
      await query(
        `update videos set
           caption = $2, thumbnail_url = $3, video_url = $4, permalink = $5,
           posted_at = $6, views = $7, likes = $8, comments = $9, shares = $10,
           saves = $11, reach = $12, raw_meta = $13, media_type = $14,
           metrics = $15, metrics_updated_at = now()
         where id = $1`,
        [
          existing.id,
          item.caption ?? null,
          item.thumbnail_url ?? null,
          item.media_url ?? null,
          item.permalink ?? null,
          item.timestamp ?? null,
          ...metrics,
          JSON.stringify({ media: item, insights }),
          mediaType,
          JSON.stringify(insights),
        ]
      );
      updated++;
    } else {
      await query(
        `insert into videos
           (ig_media_id, source, caption, media_type, thumbnail_url, video_url,
            permalink, posted_at, views, likes, comments, shares, saves, reach, raw_meta,
            metrics, metrics_updated_at)
         values ($1,'meta',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())`,
        [
          item.id,
          item.caption ?? null,
          mediaType,
          item.thumbnail_url ?? null,
          item.media_url ?? null,
          item.permalink ?? null,
          item.timestamp ?? null,
          ...metrics,
          JSON.stringify({ media: item, insights }),
          JSON.stringify(insights),
        ]
      );
      created++;
    }
  }

  return { created, updated, total: media.length };
}
