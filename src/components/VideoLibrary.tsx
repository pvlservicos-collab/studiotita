"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GlassCard, ProgressBar, EmptyState } from "@/components/ui";
import AnalysisModal from "@/components/AnalysisModal";
import { formatCount, formatDuration, formatShort } from "@/lib/metricLabels";
import type { AnalysisStatus, VideoRow } from "@/lib/types";

type PollState = { status: AnalysisStatus; startedAt: number; elapsed: number; error?: string | null };

type SortKey = "recent" | "views" | "saved" | "shares" | "comments";

const SORTS: { id: SortKey; label: string; value: (v: VideoRow) => number }[] = [
  { id: "recent", label: "Mais recentes", value: (v) => new Date(v.posted_at ?? v.created_at).getTime() },
  { id: "views", label: "Mais views", value: (v) => v.views },
  { id: "saved", label: "Mais salvos", value: (v) => v.saves },
  { id: "shares", label: "Mais compartilhados", value: (v) => v.shares },
  { id: "comments", label: "Mais comentados", value: (v) => v.comments },
];

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(d));
}

export default function VideoLibrary() {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncLimit, setSyncLimit] = useState(25);
  const [sort, setSort] = useState<SortKey>("recent");
  const [openVideoId, setOpenVideoId] = useState<string | null>(null);
  const [polls, setPolls] = useState<Record<string, PollState>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  async function loadVideos() {
    setLoadError(null);
    try {
      const res = await fetch("/api/videos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar vídeos.");
      setVideos(data.videos);
      // Retoma o acompanhamento de análises que ainda estão rodando.
      for (const v of data.videos as VideoRow[]) {
        if ((v.latest_analysis_status === "pending" || v.latest_analysis_status === "processing") && !timers.current[v.id]) {
          startPolling(v.id);
        }
      }
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVideos();
    const current = timers.current;
    return () => Object.values(current).forEach(clearInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function syncMeta() {
    setSyncing(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sync_meta", limit: syncLimit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao sincronizar com a Meta.");
      await loadVideos();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

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
        setPolls((prev) => ({
          ...prev,
          [videoId]: { status, startedAt, elapsed, error: res.ok ? data.analysis.error_message : data.error },
        }));
        if (status === "done" || status === "error") {
          clearInterval(timers.current[videoId]);
          delete timers.current[videoId];
          loadVideos();
        }
      } catch {
        // rede instável: mantém tentando até o próximo tick
      }
    }, 2000);
  }

  const sorted = useMemo(() => {
    const s = SORTS.find((x) => x.id === sort)!;
    return [...videos].sort((a, b) => s.value(b) - s.value(a));
  }, [videos, sort]);

  const openVideo = videos.find((v) => v.id === openVideoId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
            Seus <span className="gold-gradient-text">vídeos</span>
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Reels do Instagram com as métricas da Meta. O resumo e a transcrição são gerados pelo Gemini.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-xl border border-ink-200 bg-white/70 px-3 py-2 text-sm text-ink-700 outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-xl border border-ink-200 bg-white/70 px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-white"
          >
            + Adicionar manualmente
          </button>
          <div className="flex items-center overflow-hidden rounded-xl">
            <select
              value={syncLimit}
              onChange={(e) => setSyncLimit(Number(e.target.value))}
              className="h-full border border-r-0 border-gold-300 bg-white/80 px-2 py-2 text-sm text-ink-700 outline-none"
              title="Quantos posts recentes buscar"
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n} posts
                </option>
              ))}
            </select>
            <button onClick={syncMeta} disabled={syncing} className="btn-gold px-4 py-2 text-sm font-semibold disabled:opacity-60">
              {syncing ? "Sincronizando..." : "Sincronizar com a Meta"}
            </button>
          </div>
        </div>
      </div>

      {showAddForm && (
        <AddVideoForm
          onCreated={() => {
            setShowAddForm(false);
            loadVideos();
          }}
        />
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-ink-400">Carregando vídeos...</div>
      ) : loadError ? (
        <GlassCard className="p-8 text-center text-sm text-rose-600">{loadError}</GlassCard>
      ) : videos.length === 0 ? (
        <EmptyState title="Nenhum vídeo ainda" description="Sincronize com a Meta ou adicione um vídeo manualmente para começar." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {sorted.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              poll={polls[video.id]}
              onOpen={() => setOpenVideoId(video.id)}
            />
          ))}
        </div>
      )}

      {openVideo && (
        <AnalysisModal
          video={openVideo}
          busy={isBusy(polls[openVideo.id]?.status ?? openVideo.latest_analysis_status)}
          onClose={() => setOpenVideoId(null)}
          onRequested={() => startPolling(openVideo.id)}
          onChanged={loadVideos}
        />
      )}
    </div>
  );
}

const isBusy = (s?: AnalysisStatus | null) => s === "pending" || s === "processing";

function VideoCard({ video, poll, onOpen }: { video: VideoRow; poll?: PollState; onOpen: () => void }) {
  const status = poll?.status ?? video.latest_analysis_status;
  const busy = isBusy(status);
  const m = video.metrics ?? {};

  return (
    <GlassCard strong className="flex flex-col overflow-hidden">
      {/* métricas no topo do card */}
      <div className="space-y-1.5 px-3 pb-2 pt-3">
        <div className="flex justify-between gap-1.5 text-ink-800">
          <Stat icon={<EyeIcon />} value={video.views} title="Visualizações" />
          <Stat icon={<HeartIcon />} value={video.likes} title="Curtidas" />
          <Stat icon={<CommentIcon />} value={video.comments} title="Comentários" />
          <Stat icon={<BookmarkIcon />} value={video.saves} title="Salvamentos" />
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10.5px] text-ink-400">
          <span title={`Compartilhamentos: ${formatCount(video.shares, false)}`}>↗ {formatShort(video.shares)}</span>
          <span title={`Alcance: ${formatCount(video.reach, false)}`}>alc. {formatShort(video.reach)}</span>
          {m.ig_reels_avg_watch_time != null && <span title="Tempo médio assistido">⏱ {formatDuration(m.ig_reels_avg_watch_time)}</span>}
          {m.reels_skip_rate != null && <span title="Taxa de pulo">pulo {Math.round(m.reels_skip_rate)}%</span>}
        </div>
      </div>

      {/* capa vertical 9:16 */}
      <button onClick={onOpen} className="group relative block aspect-[9/16] w-full overflow-hidden bg-ink-100">
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-400">sem capa</div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur">
          {formatDate(video.posted_at)}
        </span>
        {status === "done" && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold text-ink-800 shadow">
            ✦ Gemini
          </span>
        )}
        {status === "error" && (
          <span className="absolute right-2 top-2 rounded-full bg-rose-500/90 px-2 py-0.5 text-[10.5px] font-semibold text-white">
            erro
          </span>
        )}
        {busy && (
          <div className="absolute inset-x-0 bottom-0 space-y-1.5 bg-gradient-to-t from-black/75 to-transparent p-3 pt-8">
            <div className="flex justify-between text-[11px] text-white">
              <span>Gemini analisando...</span>
              <span className="font-mono">{poll?.elapsed ?? 0}s</span>
            </div>
            <ProgressBar progress={0} indeterminate />
          </div>
        )}
      </button>

      <p className="line-clamp-2 min-h-[2.5rem] px-3 pt-2 text-xs leading-snug text-ink-700">
        {video.caption || <span className="text-ink-400">Sem legenda</span>}
      </p>

      {/* botões embaixo */}
      <div className="mt-auto flex gap-1.5 p-3 pt-2">
        <button
          onClick={onOpen}
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${
            status === "done" ? "border border-gold-300 bg-white text-gold-700 hover:bg-gold-50" : "btn-gold"
          }`}
        >
          {busy ? "Acompanhar" : status === "done" ? "Ver análise" : "Analisar com Gemini"}
        </button>
        {video.permalink && (
          <a
            href={video.permalink}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir no Instagram"
            className="flex items-center rounded-lg border border-ink-200 bg-white px-2.5 text-xs text-ink-600 hover:bg-ink-50"
          >
            ↗
          </a>
        )}
      </div>
    </GlassCard>
  );
}

function Stat({ icon, value, title }: { icon: React.ReactNode; value: number; title: string }) {
  return (
    <div className="flex items-center gap-1 whitespace-nowrap" title={`${title}: ${formatCount(value, false)}`}>
      <span className="text-ink-500">{icon}</span>
      <span className="text-xs font-semibold">{formatShort(value)}</span>
    </div>
  );
}

const iconProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const EyeIcon = () => (
  <svg {...iconProps}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const HeartIcon = () => (
  <svg {...iconProps}>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
  </svg>
);
const CommentIcon = () => (
  <svg {...iconProps}>
    <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5Z" />
  </svg>
);
const BookmarkIcon = () => (
  <svg {...iconProps}>
    <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" />
  </svg>
);

function AddVideoForm({ onCreated }: { onCreated: () => void }) {
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => videoUrl.trim().length > 0, [videoUrl]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caption, video_url: videoUrl, thumbnail_url: thumbnailUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar vídeo.");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          className="rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-gold-400 sm:col-span-3"
          placeholder="Legenda (opcional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <input
          className="rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-gold-400 sm:col-span-2"
          placeholder="URL do vídeo (obrigatório para analisar com o Gemini)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        <input
          className="rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-gold-400"
          placeholder="URL da capa (opcional)"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
        />
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button
          onClick={save}
          disabled={!canSave || saving}
          className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar vídeo"}
        </button>
      </div>
    </GlassCard>
  );
}
