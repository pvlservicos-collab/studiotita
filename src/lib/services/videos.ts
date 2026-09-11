import { query, queryOne } from "@/lib/db";
import type { VideoRow } from "@/lib/types";
import { fetchRecentMedia, fetchMediaInsights } from "@/lib/meta";

const LIST_QUERY = `
  select v.*,
         la.status  as latest_analysis_status,
         la.summary as latest_analysis_summary
  from videos v
  left join lateral (
    select status, summary
    from analyses a
    where a.video_id = v.id
    order by a.requested_at desc
    limit 1
  ) la on true
  order by coalesce(v.posted_at, v.created_at) desc
`;

export async function listVideos(): Promise<VideoRow[]> {
  return query<VideoRow>(LIST_QUERY);
}

export async function getVideo(id: string): Promise<VideoRow | null> {
  return queryOne<VideoRow>(
    `select v.*,
            la.status  as latest_analysis_status,
            la.summary as latest_analysis_summary
     from videos v
     left join lateral (
       select status, summary
       from analyses a
       where a.video_id = v.id
       order by a.requested_at desc
       limit 1
     ) la on true
     where v.id = $1`,
    [id]
  );
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
 * incluindo os insights por mídia (views/likes/comments/shares/saves).
 */
export async function syncVideosFromMeta(limit = 25) {
  const media = await fetchRecentMedia(limit);
  let created = 0;
  let updated = 0;

  for (const item of media) {
    if (item.media_type !== "VIDEO" && item.media_type !== "REELS") continue;

    let insights: Record<string, number> = {};
    try {
      insights = await fetchMediaInsights(item.id);
    } catch {
      // Alguns tipos de mídia não têm todas as métricas — segue sem travar o sync.
    }

    const existing = await queryOne<{ id: string }>(
      `select id from videos where ig_media_id = $1`,
      [item.id]
    );

    if (existing) {
      await query(
        `update videos set
           caption = $2, thumbnail_url = $3, video_url = $4, permalink = $5,
           posted_at = $6, views = $7, likes = $8, comments = $9, shares = $10,
           saves = $11, raw_meta = $12
         where id = $1`,
        [
          existing.id,
          item.caption ?? null,
          item.thumbnail_url ?? null,
          item.media_url ?? null,
          item.permalink ?? null,
          item.timestamp ?? null,
          insights.plays ?? insights.reach ?? 0,
          insights.likes ?? 0,
          insights.comments ?? 0,
          insights.shares ?? 0,
          insights.saved ?? 0,
          JSON.stringify({ media: item, insights }),
        ]
      );
      updated++;
    } else {
      await query(
        `insert into videos
           (ig_media_id, source, caption, media_type, thumbnail_url, video_url,
            permalink, posted_at, views, likes, comments, shares, saves, raw_meta)
         values ($1,'meta',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          item.id,
          item.caption ?? null,
          item.media_type,
          item.thumbnail_url ?? null,
          item.media_url ?? null,
          item.permalink ?? null,
          item.timestamp ?? null,
          insights.plays ?? insights.reach ?? 0,
          insights.likes ?? 0,
          insights.comments ?? 0,
          insights.shares ?? 0,
          insights.saved ?? 0,
          JSON.stringify({ media: item, insights }),
        ]
      );
      created++;
    }
  }

  return { created, updated, total: media.length };
}
