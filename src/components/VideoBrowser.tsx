"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GlassCard, EmptyState } from "@/components/ui";
import VideoCard, { isBusy, type PollState } from "@/components/VideoCard";
import AnalysisModal from "@/components/AnalysisModal";
import ReportDialog from "@/components/ReportDialog";
import { analyzeQueue } from "@/lib/analyzeQueue";
import { PERIODS, RANK_METRICS, rankValue, selectBest, type PeriodId, type RankMetric } from "@/lib/periods";
import type { AnalysisStatus, VideoRow } from "@/lib/types";

type SortKey = "recent" | "views" | "likes" | "comments" | "shares" | "saved" | "engagement";

const SORTS: { id: SortKey; label: string; value: (v: VideoRow) => number }[] = [
  { id: "recent", label: "Mais recentes", value: (v) => new Date(v.posted_at ?? v.created_at).getTime() },
  { id: "views", label: "Mais visualizações", value: (v) => v.views ?? -1 },
  { id: "likes", label: "Mais curtidas", value: (v) => v.likes ?? -1 },
  { id: "comments", label: "Mais comentários", value: (v) => v.comments ?? -1 },
  { id: "shares", label: "Mais compartilhamentos", value: (v) => v.shares ?? -1 },
  { id: "saved", label: "Mais salvamentos", value: (v) => v.saves ?? -1 },
  { id: "engagement", label: "Maior engajamento", value: (v) => rankValue(v, "engagement") },
];

const selectCls = "rounded-xl border border-ink-200 bg-white/70 px-3 py-2 text-sm text-ink-700 outline-none";

/**
 * Lista de posts com as abas "Todos os posts" e "Melhores posts" (recorte por
 * período), relatório de uma vez e análise do Gemini. Usada nos posts do
 * Augusto e nos de cada concorrente.
 */
export default function VideoBrowser({
  scopeQuery,
  actions,
  reloadToken = 0,
  hideBest = false,
  emptyTitle = "Nenhum vídeo ainda",
  emptyDescription,
  metricsNote,
  selectable = false,
  categoryFilter = false,
}: {
  /** filtro de /api/videos e /api/report, ex.: "scope=own" ou "scope=competitor&competitor_id=..." */
  scopeQuery: string;
  actions?: React.ReactNode;
  reloadToken?: number;
  hideBest?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  metricsNote?: string;
  /** caixas de seleção nos cards + "Gerar relatório com o Gemini" para os marcados */
  selectable?: boolean;
  /** filtro pelas categorias que o Gemini gerou (aparece conforme os vídeos são analisados) */
  categoryFilter?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<{ done: number; failed: number; total: number } | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "best">("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [period, setPeriod] = useState<PeriodId>("30d");
  const [metric, setMetric] = useState<RankMetric>("views");
  const [top, setTop] = useState(10);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [polls, setPolls] = useState<Record<string, PollState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  async function load() {
    setError(null);
    try {
      const res = await fetch(`/api/videos?${scopeQuery}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar vídeos.");
      setVideos(data.videos);
      // retoma o acompanhamento de análises que ainda estão rodando
      for (const v of data.videos as VideoRow[]) {
        if (isBusy(v.latest_analysis_status) && !timers.current[v.id]) startPolling(v.id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeQuery, reloadToken, searchTerm]);

  // busca por palavra (legenda, transcrição e categorias), com uma pausa ao digitar
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const current = timers.current;
    return () => Object.values(current).forEach(clearInterval);
  }, []);

  function startPolling(videoId: string) {
    if (timers.current[videoId]) clearInterval(timers.current[videoId]);
    const startedAt = Date.now();
    setPolls((prev) => ({ ...prev, [videoId]: { status: "pending", startedAt, elapsed: 0 } }));
    timers.current[videoId] = setInterval(async () => {
      try {
        const res = await fetch(`/api/analyses/${videoId}`);
        const data = await res.json();
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        const status: AnalysisStatus = res.ok ? data.analysis.status : "error";
        setPolls((prev) => ({ ...prev, [videoId]: { status, startedAt, elapsed, error: res.ok ? data.analysis.error_message : data.error } }));
        if (status === "done" || status === "error") {
          clearInterval(timers.current[videoId]);
          delete timers.current[videoId];
          load();
        }
      } catch {
        // rede instável: tenta de novo no próximo tick
      }
    }, 2000);
  }

  const all = useMemo(() => {
    const s = SORTS.find((x) => x.id === sort)!;
    return [...videos].sort((a, b) => s.value(b) - s.value(a));
  }, [videos, sort]);

  const best = useMemo(() => selectBest([...videos], period, metric, top || undefined), [videos, period, metric, top]);

  // categorias do Gemini com a origem na frente (@concorrente+Categoria)
  const prefix = (v: VideoRow) => (v.source === "competitor" ? `@${v.competitor_username}+` : v.source === "hashtag" ? `#${v.hashtag}+` : "");
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of videos) for (const c of v.latest_analysis_categories ?? []) counts.set(`${prefix(v)}${c}`, (counts.get(`${prefix(v)}${c}`) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [videos]);
  const byCategory = (list: VideoRow[]) =>
    category ? list.filter((v) => (v.latest_analysis_categories ?? []).some((c) => `${prefix(v)}${c}` === category)) : list;
  const shown = byCategory(tab === "best" ? best.videos : all);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function analyzeSelected() {
    const pending = shown.filter(
      (v) => selected.has(v.id) && v.latest_analysis_status !== "done" && !isBusy(v.latest_analysis_status) && v.media_type !== "IMAGE" && v.media_type !== "CAROUSEL_ALBUM"
    );
    if (!pending.length) return alert("Os vídeos marcados já têm relatório do Gemini (ou são imagens).");
    if (!confirm(`Gerar o relatório do Gemini de ${pending.length} vídeos? Cada um consome a API do Gemini (~30-60s, 3 por vez).`)) return;
    await analyzeQueue(pending.map((v) => v.id), (s) => {
      setBatch(s);
      if (s.done + s.failed > 0) load();
    });
    setSelected(new Set());
    load();
  }
  const reportQuery = `${scopeQuery}&mode=${tab}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ""}${
    tab === "best" ? `&period=${period}&metric=${metric}${top ? `&top=${top}` : ""}` : ""
  }`;
  const openVideo = videos.find((v) => v.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!hideBest && (
            <div className="flex gap-1 rounded-full bg-white/60 p-1">
              {[
                { id: "all" as const, label: "Todos os posts" },
                { id: "best" as const, label: "Melhores posts" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    tab === t.id ? "btn-gold" : "text-ink-500 hover:bg-white hover:text-ink-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {tab === "all" ? (
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectCls}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <>
              <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodId)} className={selectCls}>
                {PERIODS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select value={metric} onChange={(e) => setMetric(e.target.value as RankMetric)} className={selectCls}>
                {RANK_METRICS.map((m) => (
                  <option key={m.id} value={m.id}>
                    por {m.label}
                  </option>
                ))}
              </select>
              <select value={top} onChange={(e) => setTop(Number(e.target.value))} className={selectCls}>
                {[10, 20, 50, 0].map((n) => (
                  <option key={n} value={n}>
                    {n ? `Top ${n}` : "Todos do período"}
                  </option>
                ))}
              </select>
            </>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar palavra na legenda, transcrição ou categoria..."
            className="min-w-[240px] flex-1 rounded-xl border border-ink-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-gold-400"
          />
          <button
            onClick={() => setReportOpen(true)}
            disabled={!shown.length}
            className="rounded-xl border border-gold-300 bg-white px-4 py-2 text-sm font-semibold text-gold-700 hover:bg-gold-50 disabled:opacity-50"
          >
            Gerar relatório de todos
          </button>
        </div>
        {actions}
      </div>

      {categoryFilter && (
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryCounts.length === 0 ? (
            <span className="group relative">
              <button disabled className="cursor-not-allowed rounded-full border border-ink-200 bg-ink-100 px-3 py-1.5 text-xs font-medium text-ink-400">
                Filtrar por categoria
              </button>
              <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-72 rounded-lg bg-ink-900 px-3 py-2 text-xs leading-snug text-white shadow-lg group-hover:block">
                Primeiro gere os relatórios com o Gemini: marque os vídeos e clique em “Gerar relatório com o Gemini”. As categorias vão
                aparecendo aqui conforme cada vídeo é analisado.
              </span>
            </span>
          ) : (
            <>
              <span className="text-xs text-ink-500">Categorias do Gemini:</span>
              <button
                onClick={() => setCategory(null)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${!category ? "btn-gold" : "bg-ink-100 text-ink-600 hover:bg-ink-200"}`}
              >
                Todas
              </button>
              {categoryCounts.map(([name, n]) => (
                <button
                  key={name}
                  onClick={() => setCategory(category === name ? null : name)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${category === name ? "btn-gold" : "bg-ink-100 text-ink-600 hover:bg-ink-200"}`}
                >
                  {name} · {n}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {selectable && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/60 px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              className="accent-gold-600"
              checked={shown.length > 0 && shown.every((v) => selected.has(v.id))}
              onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((v) => v.id)) : new Set())}
            />
            Selecionar todos ({shown.length})
          </label>
          <button
            onClick={analyzeSelected}
            disabled={!selected.size || (batch != null && batch.done + batch.failed < batch.total)}
            className="btn-gold rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            ✦ Gerar relatório com o Gemini ({selected.size})
          </button>
          {batch && (
            <span className="text-xs text-ink-500">
              {batch.done} prontos · {batch.failed} com erro · {batch.total - batch.done - batch.failed} na fila
            </span>
          )}
        </div>
      )}

      {tab === "best" && (
        <p className="text-xs text-ink-500">
          {best.inPeriod} posts no período, mostrando {shown.length} por {RANK_METRICS.find((m) => m.id === metric)?.label.toLowerCase()}.
          {best.incomplete && " O período pode estar incompleto: sincronize mais posts para cobrir as datas mais antigas."}
        </p>
      )}
      {metricsNote && <p className="text-xs text-ink-400">{metricsNote}</p>}

      {loading ? (
        <div className="p-8 text-center text-sm text-ink-400">Carregando vídeos...</div>
      ) : error ? (
        <GlassCard className="p-8 text-center text-sm text-rose-600">{error}</GlassCard>
      ) : shown.length === 0 ? (
        <EmptyState
          title={tab === "best" && videos.length ? "Nenhum post nesse período" : emptyTitle}
          description={tab === "best" && videos.length ? "Escolha outro período ou sincronize mais posts." : emptyDescription}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((video, i) => (
            <div key={video.id} className="relative">
              {tab === "best" && (
                <span className="absolute -left-1.5 -top-1.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink-900 px-1.5 text-[11px] font-semibold text-white shadow">
                  {i + 1}
                </span>
              )}
              <VideoCard
                video={video}
                poll={polls[video.id]}
                onOpen={() => setOpenId(video.id)}
                extra={
                  selectable ? (
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-ink-600">
                      <input type="checkbox" className="accent-gold-600" checked={selected.has(video.id)} onChange={() => toggleSelected(video.id)} />
                      {video.latest_analysis_status === "done" ? "Selecionado (já tem relatório)" : "Selecionar para o relatório"}
                    </label>
                  ) : undefined
                }
              />
            </div>
          ))}
        </div>
      )}

      {openVideo && (
        <AnalysisModal
          video={openVideo}
          busy={isBusy(polls[openVideo.id]?.status ?? openVideo.latest_analysis_status)}
          onClose={() => setOpenId(null)}
          onRequested={() => startPolling(openVideo.id)}
          onChanged={load}
        />
      )}
      {reportOpen && (
        <ReportDialog videos={shown} reportQuery={reportQuery} onClose={() => setReportOpen(false)} onAnalyzed={load} />
      )}
    </div>
  );
}
