"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GlassCard, Badge, ProgressBar, EmptyState } from "@/components/ui";
import type { AnalysisStatus, VideoRow } from "@/lib/types";

type PollState = {
  status: AnalysisStatus;
  summary?: string | null;
  patterns?: string | null;
  error?: string | null;
  startedAt: number;
  elapsed: number;
};

function formatNumber(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(n);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export default function VideoLibrary() {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [polls, setPolls] = useState<Record<string, PollState>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  async function loadVideos() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/videos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar vídeos.");
      setVideos(data.videos);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVideos();
    return () => {
      Object.values(timers.current).forEach(clearInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function syncMeta() {
    setSyncing(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sync_meta", limit: 25 }),
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

        if (!res.ok) {
          setPolls((prev) => ({
            ...prev,
            [videoId]: { status: "error", error: data.error, startedAt, elapsed },
          }));
          clearInterval(timers.current[videoId]);
          return;
        }

        const a = data.analysis;
        setPolls((prev) => ({
          ...prev,
          [videoId]: {
            status: a.status,
            summary: a.summary,
            patterns: a.patterns,
            error: a.error_message,
            startedAt,
            elapsed,
          },
        }));

        if (a.status === "done" || a.status === "error") {
          clearInterval(timers.current[videoId]);
          loadVideos();
        }
      } catch {
        // rede instável: mantém tentando até o próximo tick
      }
    }, 1500);
  }

  async function requestSummary(videoId: string) {
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ video_id: videoId, requested_by: "pedro" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao pedir análise.");
      setExpanded(videoId);
      startPolling(videoId);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
            Seus <span className="gold-gradient-text">vídeos</span>
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Biblioteca de vídeos do Instagram — peça resumos ao Gemini e acompanhe os insights da Meta.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-xl border border-ink-200 bg-white/70 px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-white"
          >
            + Adicionar manualmente
          </button>
          <button
            onClick={syncMeta}
            disabled={syncing}
            className="btn-gold rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {syncing ? "Sincronizando..." : "Sincronizar com a Meta"}
          </button>
        </div>
      </div>

      {showAddForm && <AddVideoForm onCreated={() => { setShowAddForm(false); loadVideos(); }} />}

      <GlassCard strong className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-400">Carregando vídeos...</div>
        ) : loadError ? (
          <div className="p-8 text-center text-sm text-rose-600">{loadError}</div>
        ) : videos.length === 0 ? (
          <div className="p-2">
            <EmptyState
              title="Nenhum vídeo ainda"
              description="Sincronize com a Meta ou adicione um vídeo manualmente para começar."
            />
          </div>
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3 font-medium">Vídeo</th>
                  <th className="px-3 py-3 font-medium">Publicado</th>
                  <th className="px-3 py-3 font-medium">Views</th>
                  <th className="px-3 py-3 font-medium">Likes</th>
                  <th className="px-3 py-3 font-medium">Análise</th>
                  <th className="px-5 py-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((video) => (
                  <VideoRowItem
                    key={video.id}
                    video={video}
                    poll={polls[video.id]}
                    expanded={expanded === video.id}
                    onToggle={() => setExpanded(expanded === video.id ? null : video.id)}
                    onRequestSummary={() => requestSummary(video.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function VideoRowItem({
  video,
  poll,
  expanded,
  onToggle,
  onRequestSummary,
}: {
  video: VideoRow;
  poll?: PollState;
  expanded: boolean;
  onToggle: () => void;
  onRequestSummary: () => void;
}) {
  const status = poll?.status ?? video.latest_analysis_status;
  const isBusy = status === "pending" || status === "processing";
  const summary = poll?.summary ?? video.latest_analysis_summary;

  return (
    <>
      <tr className="border-b border-ink-50 align-top transition hover:bg-white/50">
        <td className="px-5 py-3">
          <button onClick={onToggle} className="flex items-center gap-3 text-left">
            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-ink-100">
              {video.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="max-w-[280px]">
              <div className="truncate text-sm font-medium text-ink-800">
                {video.caption?.slice(0, 70) || "Sem legenda"}
              </div>
              <div className="text-xs text-ink-400">
                {video.source === "meta" ? "via Meta" : video.source === "claude_code" ? "via Claude Code" : "manual"}
              </div>
            </div>
          </button>
        </td>
        <td className="px-3 py-3 text-ink-500">{formatDate(video.posted_at)}</td>
        <td className="px-3 py-3 text-ink-500">{formatNumber(video.views)}</td>
        <td className="px-3 py-3 text-ink-500">{formatNumber(video.likes)}</td>
        <td className="px-3 py-3">
          <StatusBadge status={status} />
        </td>
        <td className="px-5 py-3 text-right">
          <button
            onClick={onRequestSummary}
            disabled={isBusy}
            className="btn-gold rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            {isBusy ? "Analisando..." : "Pedir resumo"}
          </button>
        </td>
      </tr>
      {(expanded || isBusy || status === "error") && (
        <tr className="border-b border-ink-50 bg-gold-50/30">
          <td colSpan={6} className="px-5 py-4">
            {isBusy && (
              <div className="max-w-md space-y-2">
                <div className="flex items-center justify-between text-xs text-ink-500">
                  <span>{status === "pending" ? "Enviando vídeo ao Gemini..." : "Gemini analisando o vídeo..."}</span>
                  <span className="font-mono">{poll?.elapsed ?? 0}s</span>
                </div>
                <ProgressBar progress={0} indeterminate />
              </div>
            )}
            {status === "error" && (
              <div className="text-sm text-rose-600">
                <strong>Erro na análise:</strong> {poll?.error || "erro desconhecido"}
              </div>
            )}
            {status === "done" && summary && (
              <div className="prose prose-sm max-w-2xl whitespace-pre-wrap text-sm text-ink-700">{summary}</div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function StatusBadge({ status }: { status?: AnalysisStatus | null }) {
  if (!status) return <Badge tone="neutral">Sem análise</Badge>;
  if (status === "pending" || status === "processing") return <Badge tone="warning">Analisando</Badge>;
  if (status === "done") return <Badge tone="success">Resumo pronto</Badge>;
  return <Badge tone="error">Erro</Badge>;
}

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
          placeholder="URL do vídeo (obrigatório para pedir resumo ao Gemini)"
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
