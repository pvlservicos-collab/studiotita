"use client";

import { useRef, useState } from "react";
import { mmss, paraLinha, segmentos, type VideoProject } from "@/lib/video/types";

/**
 * A linha do tempo: régua + faixas de vídeo (com onda e cortes), telas da
 * metadinha, legendas e música. Clicar move a agulha; arrastar um clipe muda
 * o tempo dele (os números finos ficam no painel ao lado).
 */
export default function Timeline({
  projeto,
  tempo,
  onda,
  selecionado,
  onSelecionar,
  onSeek,
  onMover,
}: {
  projeto: VideoProject;
  /** tempo atual na linha do tempo (segundos) */
  tempo: number;
  /** onda do áudio (0 a 1), opcional */
  onda?: number[] | null;
  selecionado?: { faixa: "tela" | "legenda"; id: string } | null;
  onSelecionar?: (sel: { faixa: "tela" | "legenda"; id: string } | null) => void;
  onSeek?: (tl: number) => void;
  onMover?: (faixa: "tela" | "legenda", id: string, deslocamento: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [arrasto, setArrasto] = useState<{ faixa: "tela" | "legenda"; id: string; x0: number } | null>(null);

  const partes = segmentos(projeto);
  const dur = partes.length ? partes[partes.length - 1].tlFim : projeto.fonte?.duracao || 0;
  if (!dur) return null;

  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / dur) * 100))}%`;
  const larguraPct = (ini: number, fim: number) => `${Math.max(0.4, ((fim - ini) / dur) * 100)}%`;

  /** posição do clique dentro da faixa → segundos */
  function tempoDoEvento(e: React.MouseEvent) {
    const caixa = ref.current?.getBoundingClientRect();
    if (!caixa) return 0;
    return Math.max(0, Math.min(dur, ((e.clientX - caixa.left) / caixa.width) * dur));
  }

  function aoSoltar(e: React.MouseEvent) {
    if (!arrasto) return;
    const caixa = ref.current?.getBoundingClientRect();
    if (caixa) {
      const delta = ((e.clientX - arrasto.x0) / caixa.width) * dur;
      if (Math.abs(delta) > 0.05) onMover?.(arrasto.faixa, arrasto.id, delta);
    }
    setArrasto(null);
  }

  const marcas = Array.from({ length: Math.min(12, Math.ceil(dur / 5)) + 1 }, (_, i) => (i * dur) / Math.min(12, Math.ceil(dur / 5)));

  return (
    <div className="select-none rounded-xl border border-ink-200 bg-white/70 p-2" onMouseUp={aoSoltar} onMouseLeave={aoSoltar}>
      <div ref={ref} className="relative">
        {/* régua */}
        <div className="relative mb-1 h-5 cursor-pointer border-b border-ink-100" onClick={(e) => onSeek?.(tempoDoEvento(e))}>
          {marcas.map((m, i) => (
            <span key={i} className="absolute -translate-x-1/2 text-[10px] text-ink-400" style={{ left: pct(m) }}>
              {mmss(m)}
            </span>
          ))}
        </div>

        {/* faixa do vídeo com onda e cortes */}
        <Faixa rotulo="Vídeo" onClick={(e) => onSeek?.(tempoDoEvento(e))}>
          <div className="absolute inset-0 flex items-end gap-[1px] overflow-hidden rounded bg-ink-900/85 px-[1px]">
            {(onda ?? []).map((v, i) => (
              <span
                key={i}
                className="flex-1 rounded-sm bg-gold-400/70"
                style={{ height: `${Math.max(4, v * 100)}%` }}
              />
            ))}
            {!onda?.length && <span className="w-full self-center text-center text-[10px] text-ink-400">vídeo do Augusto</span>}
          </div>
          {projeto.cortes.map((c, i) => {
            const ini = paraLinha(projeto, c.inicio);
            return ini == null ? null : (
              <span
                key={i}
                title={`corte ${mmss(c.inicio)}–${mmss(c.fim)}`}
                className="absolute top-0 h-full w-[2px] bg-rose-500"
                style={{ left: pct(ini) }}
              />
            );
          })}
        </Faixa>

        {/* telas da metadinha */}
        <Faixa rotulo="Telas" onClick={(e) => onSeek?.(tempoDoEvento(e))}>
          {projeto.telas.map((t) => {
            const ini = paraLinha(projeto, t.inicio) ?? 0;
            const fim = paraLinha(projeto, t.fim) ?? ini;
            const sel = selecionado?.faixa === "tela" && selecionado.id === t.id;
            return (
              <button
                key={t.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSelecionar?.({ faixa: "tela", id: t.id });
                  setArrasto({ faixa: "tela", id: t.id, x0: e.clientX });
                }}
                className={`absolute top-0 h-full overflow-hidden rounded px-1 text-left text-[10px] ${
                  sel ? "bg-gold-500 text-ink-900 ring-2 ring-gold-700" : "bg-gold-200 text-ink-800 hover:bg-gold-300"
                }`}
                style={{ left: pct(ini), width: larguraPct(ini, fim) }}
                title={`${t.cena.titulo ?? t.cena.tipo} (${mmss(t.inicio)}–${mmss(t.fim)})`}
              >
                {t.cena.titulo ?? t.cena.tipo}
              </button>
            );
          })}
        </Faixa>

        {/* legendas */}
        <Faixa rotulo="Legendas" onClick={(e) => onSeek?.(tempoDoEvento(e))}>
          {projeto.legendas.map((l) => {
            const ini = paraLinha(projeto, l.inicio);
            if (ini == null) return null;
            const fim = paraLinha(projeto, l.fim) ?? ini;
            const sel = selecionado?.faixa === "legenda" && selecionado.id === l.id;
            return (
              <button
                key={l.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSelecionar?.({ faixa: "legenda", id: l.id });
                  setArrasto({ faixa: "legenda", id: l.id, x0: e.clientX });
                }}
                className={`absolute top-0 h-full overflow-hidden rounded px-1 text-left text-[10px] ${
                  sel ? "bg-emerald-500 text-white ring-2 ring-emerald-700" : "bg-emerald-200 text-ink-800 hover:bg-emerald-300"
                }`}
                style={{ left: pct(ini), width: larguraPct(ini, fim) }}
                title={l.texto}
              >
                {l.texto}
              </button>
            );
          })}
        </Faixa>

        {/* música */}
        <Faixa rotulo="Música" onClick={(e) => onSeek?.(tempoDoEvento(e))}>
          {projeto.musica ? (
            <div className="absolute inset-0 flex items-center rounded bg-violet-200 px-2 text-[10px] text-ink-800">
              ♪ {projeto.musica.nome || "música"} · volume {Math.round((projeto.musica.volume ?? 0) * 100)}%
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center rounded border border-dashed border-ink-200 px-2 text-[10px] text-ink-400">
              sem música
            </div>
          )}
        </Faixa>

        {/* agulha */}
        <div className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-rose-600" style={{ left: pct(tempo) }}>
          <span className="absolute -top-1 -left-[5px] h-3 w-3 rounded-full bg-rose-600" />
        </div>
      </div>
    </div>
  );
}

function Faixa({ rotulo, children, onClick }: { rotulo: string; children: React.ReactNode; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className="w-16 shrink-0 text-right text-[10px] font-medium uppercase tracking-wide text-ink-400">{rotulo}</span>
      <div className="relative h-8 flex-1 cursor-pointer rounded bg-ink-50" onClick={onClick}>
        {children}
      </div>
    </div>
  );
}
