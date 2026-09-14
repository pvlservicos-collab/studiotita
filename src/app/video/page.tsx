"use client";

import { useEffect, useState } from "react";
import { EmptyState, GlassCard, SectionTitle } from "@/components/ui";
import VideoEditor from "@/components/video/VideoEditor";
import { mmss } from "@/lib/video/types";
import type { StudioFlowRow } from "@/lib/types";

interface ProjetoLinha {
  id: string;
  title: string;
  flow_id: string | null;
  flow_title: string | null;
  source_name: string | null;
  duration: number | null;
  status: string;
  updated_at: string;
}

/**
 * Aba Vídeo: a lista dos projetos e o editor.
 * Um projeto junta o vídeo que o Augusto gravou com a metadinha gerada, as
 * legendas, os cortes de silêncio e a música — tudo numa linha do tempo.
 */
export default function VideoPage() {
  const [projetos, setProjetos] = useState<ProjetoLinha[]>([]);
  const [fluxos, setFluxos] = useState<StudioFlowRow[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const r = await fetch("/api/video-projects").then((x) => x.json());
    setProjetos(r.projects ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    fetch("/api/studio-flows?limit=100")
      .then((r) => r.json())
      .then((d) => setFluxos(d.flows ?? []));
  }, []);

  async function criar(flowId: string | null, titulo: string) {
    setCriando(true);
    setErro(null);
    try {
      const res = await fetch("/api/video-projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flow_id: flowId, title: titulo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Erro ao criar o projeto.");
      await carregar();
      setAberto(d.project.id);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCriando(false);
    }
  }

  async function apagar(id: string) {
    if (!confirm("Apagar este projeto de vídeo? O arquivo enviado continua no armazenamento.")) return;
    await fetch(`/api/video-projects/${id}`, { method: "DELETE" });
    carregar();
  }

  if (aberto) {
    return (
      <VideoEditor
        id={aberto}
        onVoltar={() => {
          setAberto(null);
          carregar();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Edição"
        title="Vídeo"
        subtitle="Monte o reel: o vídeo que o Augusto gravou em cima, a metadinha rodando embaixo, legenda automática, cortes nos silêncios e música. No fim, é só exportar."
      />

      {erro && <p className="text-sm text-rose-600">{erro}</p>}

      <GlassCard strong className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-ink-900">Começar um vídeo novo</h2>
        <p className="text-xs text-ink-500">
          Escolha a metadinha que vai rodar na tela. As telas entram na linha do tempo nos tempos do fluxo e, se o vídeo de
          referência já tiver transcrição, as legendas também já vêm prontas. O arquivo gravado você envia dentro do editor.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => criar(null, "Vídeo novo")}
            disabled={criando}
            className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            Vídeo em branco
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fluxos.slice(0, 12).map((f) => (
            <button
              key={f.id}
              onClick={() => criar(f.id, f.title)}
              disabled={criando}
              className="flex items-center gap-2 rounded-xl border border-gold-200 bg-white/80 p-2 text-left hover:border-gold-400 disabled:opacity-50"
            >
              {f.video_thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.video_thumbnail_url} alt="" className="aspect-[9/16] w-9 shrink-0 rounded object-cover" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-ink-800">{f.title}</span>
                <span className="block text-[10.5px] text-ink-400">
                  {Array.isArray(f.scenes) ? (f.scenes as unknown[]).length : 0} telas · {f.kind === "referencia" ? "fluxo do Augusto" : "metadinha gerada"}
                </span>
              </span>
            </button>
          ))}
        </div>
      </GlassCard>

      {carregando ? (
        <p className="text-sm text-ink-400">Carregando...</p>
      ) : projetos.length === 0 ? (
        <EmptyState title="Nenhum vídeo ainda" description="Escolha uma metadinha acima para montar o primeiro." />
      ) : (
        <div className="space-y-2">
          {projetos.map((p) => (
            <GlassCard key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink-900">{p.title}</div>
                <div className="text-[11px] text-ink-400">
                  {p.flow_title ? `metadinha: ${p.flow_title} · ` : ""}
                  {p.source_name ? `${p.source_name} · ${mmss(Number(p.duration ?? 0))}` : "sem vídeo enviado"} ·{" "}
                  {new Date(p.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {p.status}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAberto(p.id)} className="btn-gold rounded-lg px-3 py-1.5 text-xs font-semibold">
                  Abrir editor
                </button>
                <button onClick={() => apagar(p.id)} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-rose-50 hover:text-rose-700">
                  Apagar
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
