"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GlassCard, EmptyState } from "@/components/ui";
import VideoCard, { isBusy, type PollState } from "@/components/VideoCard";
import AnalysisModal from "@/components/AnalysisModal";
import ReportDialog from "@/components/ReportDialog";
import { PERIODS, RANK_METRICS, selectBest, type PeriodId, type RankMetric } from "@/lib/periods";
import type { AnalysisStatus, VideoRow } from "@/lib/types";

type SortKey = "recent" | "views" | "saved" | "shares" | "comments";

const SORTS: { id: SortKey; label: string; value: (v: VideoRow) => number }[] = [
  { id: "recent", label: "Mais recentes", value: (v) => new Date(v.posted_at ?? v.created_at).getTime() },
  { id: "views", label: "Mais views", value: (v) => v.views ?? -1 },
  { id: "saved", label: "Mais salvos", value: (v) => v.saves ?? -1 },
  { id: "shares", label: "Mais compartilhados", value: (v) => v.shares ?? -1 },
  { id: "comments", label: "Mais comentados", value: (v) => v.comments ?? -1 },
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
}: {
  /** filtro de /api/videos e /api/report, ex.: "scope=own" ou "scope=competitor&competitor_id=..." */
  scopeQuery: string;
  actions?: React.ReactNode;
  reloadToken?: number;
  hideBest?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  metricsNote?: string;
}) {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "best">("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [period, setPeriod] = useState<PeriodId>("30d");
  const [metric, setMetric] = useState<RankMetric>("views");
  const [top, setTop] = useState(10);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [polls, setPolls] = useState<Record<string, PollState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  async function load() {
    setError(null);
    try {
      const res = await fetch(`/api/videos?${scopeQuery}`);
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
  }, [scopeQuery, reloadToken]);

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
  const shown = tab === "best" ? best.videos : all;
  const reportQuery = `${scopeQuery}&mode=${tab}${tab === "best" ? `&period=${period}&metric=${metric}${top ? `&top=${top}` : ""}` : ""}`;
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
              <VideoCard video={video} poll={polls[video.id]} onOpen={() => setOpenId(video.id)} />
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
