"use client";

import { useState } from "react";
import { Badge, ProgressBar } from "@/components/ui";
import type { VideoRow } from "@/lib/types";

/**
 * Relatório de todos os posts da lista atual (Todos ou Melhores), de uma vez.
 * Opcionalmente manda antes ao Gemini os vídeos que ainda não têm análise.
 */
export default function ReportDialog({
  videos,
  reportQuery,
  onClose,
  onAnalyzed,
}: {
  videos: VideoRow[];
  /** parâmetros de /api/report (escopo + modo + período) */
  reportQuery: string;
  onClose: () => void;
  onAnalyzed: () => void;
}) {
  const pending = videos.filter(
    (v) =>
      v.latest_analysis_status !== "done" &&
      v.latest_analysis_status !== "pending" &&
      v.latest_analysis_status !== "processing" &&
      v.media_type !== "IMAGE" &&
      v.media_type !== "CAROUSEL_ALBUM"
  );
  const analyzed = videos.filter((v) => v.latest_analysis_status === "done").length;
  const [transcripts, setTranscripts] = useState(false);
  const [frames, setFrames] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [batch, setBatch] = useState<{ done: number; failed: number; total: number } | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/report?${reportQuery}${transcripts ? "&transcripts=1" : ""}${frames ? "&frames=1" : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar relatório.");
      setReport(data.markdown);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /** Analisa os pendentes, 3 por vez, esperando cada um terminar. */
  async function analyzePending() {
    if (!confirm(`Mandar ${pending.length} vídeos ao Gemini? Cada análise consome a API do Gemini (~30-60s cada, 3 por vez).`)) return;
    const queue = [...pending];
    const state = { done: 0, failed: 0, total: queue.length };
    setBatch({ ...state });

    const runOne = async (v: VideoRow) => {
      try {
        const res = await fetch("/api/analyses", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ video_id: v.id, requested_by: "pedro" }),
        });
        if (!res.ok) throw new Error();
        for (let i = 0; i < 100; i++) {
          await new Promise((r) => setTimeout(r, 4000));
          const s = await fetch(`/api/analyses/${v.id}`).then((r) => r.json());
          if (s.analysis?.status === "done") return state.done++;
          if (s.analysis?.status === "error") throw new Error();
        }
        throw new Error();
      } catch {
        state.failed++;
      } finally {
        setBatch({ ...state });
      }
    };
    const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length) await runOne(queue.shift()!);
    });
    await Promise.all(workers);
    onAnalyzed();
  }

  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([report], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-posts-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    if (!report) return;
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const batchRunning = batch != null && batch.done + batch.failed < batch.total;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-3 backdrop-blur-sm sm:p-8" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-gold-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 p-5">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Relatório de todos os posts</h2>
            <p className="text-xs text-ink-500">
              {videos.length} posts nesta lista · {analyzed} com análise do Gemini · {pending.length} vídeos sem análise
            </p>
          </div>
          <button onClick={onClose} className="px-2 text-lg leading-none text-ink-400 hover:text-ink-700" aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="space-y-4 p-5">
          {pending.length > 0 && (
            <div className="space-y-2 rounded-xl border border-gold-200 bg-gold-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-ink-700">
                  <strong>{pending.length}</strong> vídeos ainda não foram analisados. O relatório fica mais completo com resumo, gancho e estrutura de todos.
                </div>
                <button onClick={analyzePending} disabled={batchRunning} className="btn-gold rounded-lg px-3 py-1.5 text-xs font-semibold">
                  {batchRunning ? "Analisando..." : `Analisar os ${pending.length} com o Gemini`}
                </button>
              </div>
              {batch && (
                <div className="space-y-1">
                  <div className="text-xs text-ink-500">
                    {batch.done} prontos · {batch.failed} com erro · {batch.total - batch.done - batch.failed} na fila
                  </div>
                  <ProgressBar progress={((batch.done + batch.failed) / batch.total) * 100} />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={transcripts} onChange={(e) => setTranscripts(e.target.checked)} className="accent-gold-600" />
                Incluir as transcrições
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={frames} onChange={(e) => setFrames(e.target.checked)} className="accent-gold-600" />
                Incluir o frame a frame
              </label>
            </div>
            <button onClick={generate} disabled={loading} className="btn-gold rounded-lg px-4 py-2 text-sm font-semibold">
              {loading ? "Gerando..." : report ? "Gerar de novo" : "Gerar relatório"}
            </button>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}

          {report && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="gold">{Math.round(report.length / 1000)} mil caracteres · Markdown</Badge>
                <div className="flex gap-2">
                  <button onClick={copy} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50">
                    {copied ? "Copiado ✓" : "Copiar"}
                  </button>
                  <button onClick={download} className="btn-gold rounded-lg px-3 py-1.5 text-xs font-semibold">
                    Baixar .md
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                value={report}
                rows={16}
                className="w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 font-mono text-xs leading-relaxed text-ink-700"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
