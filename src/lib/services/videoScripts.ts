/**
 * Roteiros extraídos dos vídeos: o que o Gemini tirou de cada vídeo analisado
 * (gancho, estrutura, transcrição, categorias). Do Augusto e dos concorrentes,
 * guardados para sempre como a biblioteca de referência dos roteiros novos.
 */
import { query } from "@/lib/db";

export interface VideoScriptRow {
  video_id: string;
  caption: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  posted_at: string | null;
  source: string;
  competitor_id: string | null;
  competitor_username: string | null;
  hashtag: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  metrics: Record<string, number> | null;
  analysis_id: string;
  summary: string | null;
  transcript: string | null;
  structure: string | null;
  hook: string | null;
  frames: string | null;
  categories: string[] | null;
  rules_fit: string | null;
  model: string | null;
  completed_at: string | null;
  /** metadinha do Estúdio Reels deste vídeo (a mais recente pronta) */
  flow_id: string | null;
  flow_title: string | null;
  flow_summary: string | null;
  flow_scenes: unknown;
}

export async function listVideoScripts(opts: { scope?: "own" | "competitor" | "all"; competitorId?: string; search?: string; limit?: number } = {}) {
  const where: string[] = [];
  const params: unknown[] = [];
  const scope = opts.scope ?? "all";
  if (scope === "own") where.push(`v.competitor_id is null and v.hashtag is null`);
  if (scope === "competitor") where.push(`(v.competitor_id is not null or v.hashtag is not null)`);
  if (opts.competitorId) {
    params.push(opts.competitorId);
    where.push(`v.competitor_id = $${params.length}`);
  }
  if (opts.search?.trim()) {
    params.push(`%${opts.search.trim()}%`);
    where.push(`(v.caption ilike $${params.length} or la.transcript ilike $${params.length} or array_to_string(la.categories, ' ') ilike $${params.length})`);
  }
  params.push(Math.min(opts.limit ?? 200, 500));
  return query<VideoScriptRow>(
    `select v.id as video_id, v.caption, v.thumbnail_url, v.permalink, v.posted_at, v.source, v.competitor_id,
            c.username as competitor_username, v.hashtag, v.views, v.likes, v.comments, v.saves, v.shares, v.metrics,
            la.id as analysis_id, la.summary, la.transcript, la.structure, la.hook, la.frames, la.categories, la.rules_fit, la.model, la.completed_at,
            sf.id as flow_id, sf.title as flow_title, sf.summary as flow_summary, sf.scenes as flow_scenes
     from videos v
     left join competitors c on c.id = v.competitor_id
     join lateral (
       select * from analyses a where a.video_id = v.id and a.status = 'done' order by a.requested_at desc limit 1
     ) la on true
     left join lateral (
       select id, title, summary, scenes from studio_flows f
       where f.video_id = v.id and f.status = 'done' and f.scenes is not null
       order by (f.kind = 'referencia') desc, f.created_at desc limit 1
     ) sf on true
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by la.completed_at desc nulls last
     limit $${params.length}`,
    params
  );
}
