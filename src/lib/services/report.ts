/**
 * Relatório de posts (Todos ou Melhores) em Markdown: métricas + tudo o que
 * o Gemini gerou de cada vídeo. O painel baixa/copia; o MCP devolve o texto.
 */
import { query } from "@/lib/db";
import { listVideos, type VideoFilter } from "@/lib/services/videos";
import { periodRange, rankValue, RANK_METRICS, selectBest, type PeriodId, type RankMetric } from "@/lib/periods";
import { VIDEO_METRICS, formatMetric } from "@/lib/metricLabels";
import type { AnalysisRow, VideoRow } from "@/lib/types";

export interface ReportOptions extends VideoFilter {
  mode?: "all" | "best";
  period?: PeriodId;
  metric?: RankMetric;
  top?: number;
  includeTranscripts?: boolean;
}

type DoneAnalysis = Pick<AnalysisRow, "video_id" | "summary" | "transcript" | "structure" | "hook" | "categories" | "rules_fit" | "model">;

export async function latestDoneAnalyses(videoIds: string[]) {
  if (!videoIds.length) return new Map<string, DoneAnalysis>();
  const rows = await query<DoneAnalysis>(
    `select distinct on (video_id) video_id, summary, transcript, structure, hook, categories, rules_fit, model
     from analyses where status = 'done' and video_id = any($1::uuid[])
     order by video_id, requested_at desc`,
    [videoIds]
  );
  return new Map(rows.map((r) => [r.video_id, r]));
}

export async function selectPosts(opts: ReportOptions) {
  const all = await listVideos(opts);
  if (opts.mode !== "best") return { videos: all, label: "Todos os posts", incomplete: false };
  const period = opts.period ?? "30d";
  const metric = opts.metric ?? "views";
  const best = selectBest(all, period, metric, opts.top);
  const metricLabel = RANK_METRICS.find((m) => m.id === metric)?.label ?? metric;
  return { videos: best.videos, label: `Melhores posts · ${periodRange(period).label} · por ${metricLabel}`, incomplete: best.incomplete };
}

function origin(v: VideoRow) {
  if (v.source === "competitor") return `@${v.competitor_username ?? "concorrente"}`;
  if (v.source === "hashtag") return `#${v.hashtag}`;
  return "@augustotita";
}

function title(v: VideoRow) {
  return (v.caption ?? "Sem legenda").split("\n")[0].slice(0, 90);
}

export function metricsLine(v: VideoRow) {
  const m = { ...(v.metrics ?? {}) };
  return VIDEO_METRICS.filter((mt) => m[mt.key] != null && !["total_views", "crossposted_views", "facebook_views"].includes(mt.key))
    .map((mt) => `${mt.label}: ${formatMetric(m[mt.key], mt.unit, false)}`)
    .join(" · ");
}

export async function buildReport(opts: ReportOptions) {
  const { videos, label, incomplete } = await selectPosts(opts);
  const analyses = await latestDoneAnalyses(videos.map((v) => v.id));
  const date = new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
  const analyzed = videos.filter((v) => analyses.has(v.id)).length;

  const lines: string[] = [
    `# Relatório de posts — ${label}`,
    "",
    `Gerado em ${date} · ${videos.length} posts · ${analyzed} com análise do Gemini`,
    incomplete ? "\n> Atenção: o período pode estar incompleto — sincronize mais posts para cobrir as datas mais antigas." : "",
    "",
    "## Resumo em tabela",
    "",
    "| # | Post | Data | Views | Curtidas | Coment. | Salv. | Compart. | Engaj. |",
    "|---|---|---|---|---|---|---|---|---|",
    ...videos.map(
      (v, i) =>
        `| ${i + 1} | ${title(v).replace(/\|/g, "/").slice(0, 50)} | ${v.posted_at ? new Date(v.posted_at).toLocaleDateString("pt-BR") : "—"} | ${v.views ?? "—"} | ${v.likes ?? "—"} | ${v.comments ?? "—"} | ${v.saves ?? "—"} | ${v.shares ?? "—"} | ${rankValue(v, "engagement").toFixed(1)}% |`
    ),
    "",
  ];

  videos.forEach((v, i) => {
    const a = analyses.get(v.id);
    lines.push(
      `## ${i + 1}. ${title(v)}`,
      "",
      `${origin(v)} · ${v.posted_at ? new Date(v.posted_at).toLocaleDateString("pt-BR") : "sem data"}${v.permalink ? ` · ${v.permalink}` : ""}`,
      "",
      `**Métricas:** ${metricsLine(v) || "sem métricas"}`,
      ""
    );
    if (!a) {
      lines.push("_Sem análise do Gemini ainda._", "");
      return;
    }
    if (a.categories?.length) lines.push(`**Categorias (Gemini):** ${a.categories.join(", ")}`, "");
    if (a.summary) lines.push(`**Resumo (Gemini):**`, a.summary, "");
    if (a.hook) lines.push(`**Gancho identificado pelo Gemini:**`, a.hook, "");
    if (a.structure) lines.push(`**Estrutura gerada pelo Gemini:**`, a.structure, "");
    if (a.rules_fit) lines.push(`**Adequação às regras do Augusto:**`, a.rules_fit, "");
    if (opts.includeTranscripts && a.transcript) lines.push(`**Transcrição (Gemini):**`, a.transcript, "");
  });

  return { markdown: lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n"), count: videos.length, analyzed, label };
}
