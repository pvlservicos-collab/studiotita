/**
 * Pontuação interna dos roteiros (0 a 100), a partir dos números dos vídeos:
 *  - roteiro ligado a um vídeo publicado → resultado real daquele vídeo;
 *  - roteiro gerado → média dos vídeos de referência que o originaram.
 * Cada vídeo é comparado com os da mesma origem (Augusto com Augusto, cada
 * concorrente com ele mesmo): 60% percentil de views + 40% percentil de engajamento.
 */
import { query } from "@/lib/db";
import { rankValue } from "@/lib/periods";
import type { VideoRow } from "@/lib/types";

type ScoreVideo = Pick<VideoRow, "id" | "source" | "competitor_id" | "hashtag" | "views" | "likes" | "comments" | "saves" | "shares" | "reach" | "metrics" | "thumbnail_url" | "caption" | "permalink">;

export interface VideoScore {
  score: number;
  views: number | null;
  comments: number | null;
  likes: number | null;
  saves: number | null;
  thumbnail_url: string | null;
  caption: string | null;
  permalink: string | null;
}

export interface ScriptScore {
  score: number;
  basis: "resultado" | "referencias";
  videos: number;
  avg_views: number | null;
  avg_comments: number | null;
  avg_likes: number | null;
  avg_saves: number | null;
}

function percentile(values: number[], v: number) {
  if (values.length < 2) return 50;
  let below = 0;
  let equal = 0;
  for (const x of values) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return ((below + equal * 0.5) / values.length) * 100;
}

/** Calcula a nota de todos os vídeos de uma vez (algumas centenas de linhas). */
export async function buildScoreContext() {
  const videos = await query<ScoreVideo>(
    `select id, source, competitor_id, hashtag, views, likes, comments, saves, shares, reach, metrics, thumbnail_url, caption, permalink from videos`
  );
  const pools = new Map<string, ScoreVideo[]>();
  const poolKey = (v: ScoreVideo) => (v.competitor_id ? `c:${v.competitor_id}` : v.hashtag ? `h:${v.hashtag}` : "own");
  for (const v of videos) pools.set(poolKey(v), [...(pools.get(poolKey(v)) ?? []), v]);

  const scores = new Map<string, VideoScore>();
  for (const pool of Array.from(pools.values())) {
    const views = pool.map((v) => v.views ?? 0);
    const eng = pool.map((v) => rankValue(v as VideoRow, "engagement"));
    for (const v of pool) {
      const score = 0.6 * percentile(views, v.views ?? 0) + 0.4 * percentile(eng, rankValue(v as VideoRow, "engagement"));
      scores.set(v.id, {
        score: Math.round(score),
        views: v.views,
        comments: v.comments,
        likes: v.likes,
        saves: v.saves,
        thumbnail_url: v.thumbnail_url,
        caption: v.caption,
        permalink: v.permalink,
      });
    }
  }
  return scores;
}

const avg = (list: (number | null)[]) => {
  const nums = list.filter((x): x is number => typeof x === "number");
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
};

export function scoreFromVideos(ids: string[], ctx: Map<string, VideoScore>, basis: ScriptScore["basis"]): ScriptScore | null {
  const found = ids.map((id) => ctx.get(id)).filter((x): x is VideoScore => Boolean(x));
  if (!found.length) return null;
  return {
    score: Math.round(found.reduce((s, v) => s + v.score, 0) / found.length),
    basis,
    videos: found.length,
    avg_views: avg(found.map((v) => v.views)),
    avg_comments: avg(found.map((v) => v.comments)),
    avg_likes: avg(found.map((v) => v.likes)),
    avg_saves: avg(found.map((v) => v.saves)),
  };
}
