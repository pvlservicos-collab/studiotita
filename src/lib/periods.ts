/**
 * Recortes de "Melhores posts" e métricas de ranking. Usado no painel, no
 * relatório e no MCP, para os três escolherem os mesmos posts.
 */
import type { VideoRow } from "@/lib/types";

export type PeriodId = "30d" | "last_month" | "quarter" | "semester";

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "30d", label: "Últimos 30 dias" },
  { id: "last_month", label: "Último mês" },
  { id: "quarter", label: "Trimestre (90 dias)" },
  { id: "semester", label: "Semestre (180 dias)" },
];

export function periodRange(id: PeriodId, now = new Date()) {
  const days = (n: number) => new Date(now.getTime() - n * 86400000);
  if (id === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    const label = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { since: start, until: end, label: `Último mês (${label})` };
  }
  const n = id === "30d" ? 30 : id === "quarter" ? 90 : 180;
  return { since: days(n), until: now, label: PERIODS.find((p) => p.id === id)!.label };
}

export type RankMetric = "views" | "saves" | "shares" | "comments" | "likes" | "engagement";

export const RANK_METRICS: { id: RankMetric; label: string }[] = [
  { id: "views", label: "Visualizações" },
  { id: "saves", label: "Salvamentos" },
  { id: "shares", label: "Compartilhamentos" },
  { id: "comments", label: "Comentários" },
  { id: "likes", label: "Curtidas" },
  { id: "engagement", label: "Engajamento (%)" },
];

/** Engajamento = interações ÷ alcance (Augusto) ou (curtidas + comentários) ÷ views (outras contas). */
export function rankValue(v: VideoRow, metric: RankMetric): number {
  const n = (x: unknown) => (typeof x === "number" ? x : x == null ? 0 : Number(x) || 0);
  if (metric === "engagement") {
    const interactions = v.metrics?.total_interactions ?? n(v.likes) + n(v.comments) + n(v.shares) + n(v.saves);
    const base = n(v.reach) || n(v.views);
    return base ? (interactions / base) * 100 : 0;
  }
  return n(v[metric]);
}

export function selectBest(videos: VideoRow[], period: PeriodId, metric: RankMetric, top?: number) {
  const { since, until } = periodRange(period);
  const inRange = videos.filter((v) => {
    const d = new Date(v.posted_at ?? v.created_at);
    return d >= since && d < until;
  });
  const sorted = inRange.sort((a, b) => rankValue(b, metric) - rankValue(a, metric));
  // o período pode estar incompleto se os posts mais antigos ainda não foram sincronizados
  const oldest = videos.reduce<Date | null>((min, v) => {
    const d = new Date(v.posted_at ?? v.created_at);
    return !min || d < min ? d : min;
  }, null);
  return { videos: top ? sorted.slice(0, top) : sorted, inPeriod: inRange.length, incomplete: !oldest || oldest > since };
}
