"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui";
import { formatShort } from "@/lib/metricLabels";
import type { StudioFlowRow } from "@/lib/types";
import type { StudioScene } from "@/lib/studio/scenes";

/**
 * Os fluxos do estúdio: os de REFERÊNCIA (que o Augusto montou de verdade,
 * ligados ao vídeo em que foram usados) e os GERADOS pelo sistema a partir
 * das análises. Qualquer um abre no estúdio pelo link.
 */
export default function StudioFlowsPanel({ onOpen }: { onOpen?: (id: string) => void }) {
  const [flows, setFlows] = useState<StudioFlowRow[]>([]);
  const [padroes, setPadroes] = useState<{ text: string; source: string } | null>(null);
  const [aba, setAba] = useState<"referencia" | "gerado" | "padroes">("referencia");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/studio-flows?limit=200")
      .then((r) => r.json())
      .then((d) => {
        setFlows(d.flows ?? []);
        setPadroes({ text: d.padroes ?? "", source: d.padroes_source ?? "padrao" });
      })
      .finally(() => setLoading(false));
  }, []);

  const lista = flows.filter((f) => f.kind === aba);

  return (
    <GlassCard strong className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-white/60 p-1">
          {[
            { id: "referencia" as const, label: `Fluxos do Augusto (${flows.filter((f) => f.kind === "referencia").length})` },
            { id: "gerado" as const, label: `Metadinhas geradas (${flows.filter((f) => f.kind === "gerado").length})` },
            { id: "padroes" as const, label: "Padrões aprendidos" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${aba === t.id ? "btn-gold" : "text-ink-500 hover:bg-white hover:text-ink-800"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Carregando...</p>
      ) : aba === "padroes" ? (
        <div className="space-y-2">
          <p className="text-xs text-ink-500">
            O que o sistema aprendeu com os fluxos e as metadinhas do Augusto. É este texto que guia toda metadinha nova.{" "}
            {padroes?.source === "biblioteca" ? (
              <>Está sendo lido do arquivo <strong>estudio-reels-padroes.md</strong> da Biblioteca.</>
            ) : (
              <>Para editar, salve um arquivo chamado <strong>estudio-reels-padroes.md</strong> na Biblioteca: ele passa a valer no lugar deste.</>
            )}
          </p>
          <div className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-white/70 p-3 text-sm leading-relaxed text-ink-700">
            {padroes?.text}
          </div>
        </div>
      ) : lista.length === 0 ? (
        <p className="text-sm text-ink-500">
          {aba === "referencia"
            ? "Nenhum fluxo de referência ainda. Rode npm run seed:fluxos para carregar os fluxos do projeto salvo no estúdio."
            : "Nenhuma metadinha gerada ainda. Analise um vídeo com o toggle “Gerar metadinha” ligado (em Posts)."}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {lista.map((f) => (
            <li key={f.id} className="flex gap-3 rounded-xl border border-ink-100 bg-white/80 p-3">
              {f.video_thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.video_thumbnail_url} alt="" className="aspect-[9/16] w-12 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-sm font-semibold text-ink-900">{f.title}</div>
                <div className="text-[11px] text-ink-400">
                  {(f.scenes as StudioScene[] | null)?.length ?? 0} cenas
                  {f.video_caption ? ` · ${f.video_caption.split("\n")[0].slice(0, 40)}` : " · sem vídeo ligado"}
                  {f.video_views != null ? ` · ${formatShort(f.video_views)} views` : ""}
                  {f.link_confidence ? ` · ligação ${f.link_confidence}` : ""}
                </div>
                {f.summary && <p className="mt-1 line-clamp-2 text-xs text-ink-600">{f.summary}</p>}
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <button
                    onClick={() => onOpen?.(f.id)}
                    className="rounded-lg border border-gold-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gold-700 hover:bg-gold-50"
                  >
                    Abrir aqui
                  </button>
                  <a
                    href={`/estudio-reels.html?fluxo=${f.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11px] text-ink-700 hover:bg-ink-50"
                  >
                    Tela cheia ↗
                  </a>
                  {f.video_permalink && (
                    <a
                      href={f.video_permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11px] text-ink-700 hover:bg-ink-50"
                    >
                      Ver o vídeo ↗
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
