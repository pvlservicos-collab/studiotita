/**
 * Grava posts de outras contas (concorrentes e hashtags) na tabela `videos`,
 * para reaproveitar cards, análise do Gemini, categorias e roteiros.
 * Salvamentos, compartilhamentos e alcance ficam nulos: a Meta não informa
 * esses números de contas que não são do Augusto.
 */
import { query } from "@/lib/db";
import type { DiscoveryMedia } from "@/lib/meta";

export async function upsertExternalMedia(
  items: DiscoveryMedia[],
  origin: { source: "competitor"; competitorId: string } | { source: "hashtag"; hashtag: string }
) {
  let saved = 0;
  for (const m of items) {
    const isVideo = m.media_type === "VIDEO" || m.media_product_type === "REELS";
    const mediaType = m.media_product_type === "REELS" ? "REELS" : ["VIDEO", "IMAGE", "CAROUSEL_ALBUM"].includes(m.media_type) ? m.media_type : "OTHER";
    const metrics: Record<string, number> = {};
    if (m.view_count != null) metrics.views = m.view_count;
    if (m.like_count != null) metrics.likes = m.like_count;
    if (m.comments_count != null) metrics.comments = m.comments_count;

    await query(
      `insert into videos
         (ig_media_id, source, competitor_id, hashtag, caption, media_type, thumbnail_url, video_url, permalink,
          posted_at, views, likes, comments, shares, saves, reach, metrics, metrics_updated_at, raw_meta)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, null, null, null, $14, now(), $15)
       on conflict (ig_media_id) do update set
         caption = excluded.caption, thumbnail_url = excluded.thumbnail_url,
         video_url = coalesce(excluded.video_url, videos.video_url), permalink = excluded.permalink,
         views = excluded.views, likes = excluded.likes, comments = excluded.comments,
         metrics = excluded.metrics, metrics_updated_at = now(), raw_meta = excluded.raw_meta,
         competitor_id = coalesce(videos.competitor_id, excluded.competitor_id),
         hashtag = coalesce(videos.hashtag, excluded.hashtag)
       where videos.source in ('competitor', 'hashtag')`,
      [
        m.id,
        origin.source,
        origin.source === "competitor" ? origin.competitorId : null,
        origin.source === "hashtag" ? origin.hashtag : null,
        m.caption ?? null,
        mediaType,
        m.thumbnail_url ?? (isVideo ? null : m.media_url ?? null),
        isVideo ? m.media_url ?? null : null,
        m.permalink ?? null,
        m.timestamp ?? null,
        m.view_count ?? null,
        m.like_count ?? null,
        m.comments_count ?? null,
        JSON.stringify(metrics),
        JSON.stringify(m),
      ]
    );
    saved++;
  }
  return saved;
}
