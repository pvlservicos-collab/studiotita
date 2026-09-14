"use client";

import { useEffect, useState } from "react";
import { GlassCard, EmptyState } from "@/components/ui";
import { formatShort, formatDuration } from "@/lib/metricLabels";
import MetadinhaPreview from "@/components/MetadinhaPreview";
import type { StudioScene } from "@/lib/studio/scenes";

type VideoScript = {
  video_id: string;
  caption: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  posted_at: string | null;
  source: string;
  competitor_username: string | null;
  hashtag: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  metrics: Record<string, number> | null;
  summary: string | null;
  transcript: string | null;
  structure: string | null;
  hook: string | null;
  frames: string | null;
  categories: string[] | null;
  model: string | null;
  completed_at: string | null;
  flow_id: string | null;
  flow_title: string | null;
  flow_summary: string | null;
  flow_scenes: StudioScene[] | null;
};

type Scope = "all" | "own" | "competitor";

/** Aba "Roteiros dos vídeos": o que o Gemini extraiu de cada vídeo analisado. Foco no texto, thumb à esquerda. */
export default function VideoScripts() {
  const [scripts, setScripts] = useState<VideoScript[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams({ scope });
      if (search.trim()) params.set("search", search.trim());
      fetch(`/api/video-scripts?${params}`)
        .then((r) => r.json())
        .then((d) => setScripts(d.scripts ?? []))
        .finally(() => setLoading(false));
    }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [scope, search]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          Roteiros dos <span className="gold-gradient-text">vídeos</span>
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          O roteiro que o Gemini extraiu de cada vídeo analisado, seu e dos concorrentes. Fica guardado para sempre e serve de referência
          para os roteiros novos.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-white/60 p-1">
          {[
            { id: "all" as const, label: "Todos" },
            { id: "own" as const, label: "Seus vídeos" },
            { id: "competitor" as const, label: "Concorrentes" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setScope(s.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${scope === s.id ? "btn-gold" : "text-ink-500 hover:bg-white hover:text-ink-800"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar na legenda, na transcrição ou nas categorias..."
          className="min-w-[220px] flex-1 rounded-xl border border-ink-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-gold-400"
        />
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-ink-400">Carregando...</div>
      ) : scripts.length === 0 ? (
        <EmptyState title="Nenhum roteiro extraído ainda" description="Analise vídeos com o Gemini (em Posts ou na página de um concorrente)." />
      ) : (
        <div className="space-y-4">
          {scripts.map((s) => (
            <VideoScriptCard key={s.video_id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoScriptCard({ s }: { s: VideoScript }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const origin = s.source === "competitor" ? `@${s.competitor_username}` : s.source === "hashtag" ? `#${s.hashtag}` : "@augustotita";

  async function copy() {
    const text = [
      (s.caption ?? "").split("\n")[0],
      `${origin} · ${s.permalink ?? ""}`,
      s.hook ? `\nGANCHO (Gemini)\n${s.hook}` : "",
      s.structure ? `\nESTRUTURA (Gemini)\n${s.structure}` : "",
      s.transcript ? `\nROTEIRO (transcrição do Gemini)\n${s.transcript}` : "",
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <GlassCard strong className="flex gap-4 p-4">
      <a href={s.permalink ?? undefined} target="_blank" rel="noopener noreferrer" className="block aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-lg bg-ink-100 sm:w-28">
        {s.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.thumbnail_url} alt="" className="h-full w-full object-cover" />
        )}
      </a>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="line-clamp-1 text-sm font-semibold text-ink-900">{(s.caption ?? "Sem legenda").split("\n")[0]}</div>
            <div className="text-xs text-ink-400">
              {origin} · {s.posted_at ? new Date(s.posted_at).toLocaleDateString("pt-BR") : "—"} · {formatShort(s.views)} views · {formatShort(s.likes)} curtidas ·{" "}
              {formatShort(s.comments)} coment.
              {s.saves != null && ` · ${formatShort(s.saves)} salv.`}
              {s.metrics?.ig_reels_avg_watch_time != null && ` · ⏱ ${formatDuration(s.metrics.ig_reels_avg_watch_time)}`}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={copy} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50">
              {copied ? "Copiado ✓" : "Copiar roteiro"}
            </button>
          </div>
        </div>
        {s.categories && s.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {s.categories.map((c) => (
              <span key={c} className="rounded-full bg-gold-50 px-2 py-0.5 text-[11px] text-gold-700">
                {c}
              </span>
            ))}
          </div>
        )}
        {s.flow_id && s.flow_scenes?.length ? (
          <div className="rounded-xl border border-gold-200 bg-gold-50/50 p-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gold-600">
                Metadinha no Estúdio Reels · {s.flow_scenes.length} telas
              </div>
              <div className="flex gap-1.5">
                <a
                  href={`/estudio-reels.html?fluxo=${s.flow_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-gold-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gold-700 hover:bg-gold-50"
                >
                  Abrir no Estúdio ↗
                </a>
                <a
                  href={`/metadinha/${s.flow_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11px] text-ink-700 hover:bg-ink-50"
                >
                  Ver tudo ↗
                </a>
              </div>
            </div>
            <MetadinhaPreview cenas={s.flow_scenes} />
            {s.flow_summary && <p className="mt-1.5 line-clamp-2 text-xs text-ink-600">{s.flow_summary}</p>}
          </div>
        ) : null}
        {s.hook && <TextBlock title="Gancho identificado pelo Gemini" text={s.hook} />}
        {s.structure && <TextBlock title="Estrutura gerada pelo Gemini" text={s.structure} clamp={!open} />}
        {open && s.transcript && <TextBlock title="Roteiro (transcrição do Gemini)" text={s.transcript} />}
        {open && s.frames && <TextBlock title="Análise frame a frame do Gemini" text={s.frames} />}
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-gold-700 hover:underline">
          {open ? "Recolher" : "Ver estrutura, transcrição e frame a frame"}
        </button>
      </div>
    </GlassCard>
  );
}

function TextBlock({ title, text, clamp = false }: { title: string; text: string; clamp?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gold-600">{title}</div>
      <div className={`whitespace-pre-wrap text-sm leading-relaxed text-ink-700 ${clamp ? "line-clamp-4" : ""}`}>{text}</div>
    </div>
  );
}
