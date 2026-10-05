"use client";

import { useRef, useState } from "react";
import { mmss, paraLinha, segmentos, type VideoProject } from "@/lib/video/types";

type FaixaId = "tela" | "legenda" | "layout" | "texto";

const ROTULOS = ["Vídeo", "Telas", "Textos", "Legendas", "Layout", "Música"];

/**
 * A linha do tempo. A coluna dos nomes fica FORA da área do tempo: a régua, as
 * faixas e a agulha dividem exatamente a mesma largura, então o 00:00 cai no
 * começo das faixas (era isso que estava torto).
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
  tempo: number;
  onda?: number[] | null;
  selecionado?: { faixa: FaixaId; id: string } | null;
  onSelecionar?: (sel: { faixa: FaixaId; id: string } | null) => void;
  onSeek?: (tl: number) => void;
  onMover?: (faixa: FaixaId, id: string, deslocamento: number) => void;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const [arrasto, setArrasto] = useState<{ faixa: FaixaId; id: string; x0: number } | null>(null);

  const partes = segmentos(projeto);
  const dur = partes.length ? partes[partes.length - 1].tlFim : projeto.fonte?.duracao || 0;
  if (!dur) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 bg-white/60 p-4 text-center text-xs text-ink-400">
        A linha do tempo aparece quando o vídeo é enviado.
      </div>
    );
  }

  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / dur) * 100))}%`;
  const larguraPct = (ini: number, fim: number) => `${Math.max(0.4, ((fim - ini) / dur) * 100)}%`;

  function tempoDoEvento(e: React.MouseEvent) {
    const caixa = pista.current?.getBoundingClientRect();
    if (!caixa) return 0;
    return Math.max(0, Math.min(dur, ((e.clientX - caixa.left) / caixa.width) * dur));
  }

  function aoSoltar(e: React.MouseEvent) {
    if (!arrasto) return;
    const caixa = pista.current?.getBoundingClientRect();
    if (caixa) {
      const delta = ((e.clientX - arrasto.x0) / caixa.width) * dur;
      if (Math.abs(delta) > 0.05) onMover?.(arrasto.faixa, arrasto.id, delta);
    }
    setArrasto(null);
  }

  const passos = Math.max(2, Math.min(10, Math.floor(dur / 10)));
  const marcas = Array.from({ length: passos + 1 }, (_, i) => (i * dur) / passos);

  return (
    <div className="select-none overflow-x-auto rounded-xl border border-ink-200 bg-white/70 p-2" onMouseUp={aoSoltar} onMouseLeave={aoSoltar}>
      <div className="flex min-w-[560px] gap-2">
        {/* coluna dos nomes — fica fora da área do tempo */}
        <div className="w-16 shrink-0 pt-5 sm:w-20">
          {ROTULOS.map((r) => (
            <div key={r} className="mb-1 flex h-8 items-center justify-end text-[10px] font-medium uppercase tracking-wide text-ink-400">
              {r}
            </div>
          ))}
        </div>

        {/* área do tempo: régua, faixas e agulha na mesma largura */}
        <div ref={pista} className="relative min-w-0 flex-1">
          <div className="relative mb-1 h-5 cursor-pointer border-b border-ink-100" onClick={(e) => onSeek?.(tempoDoEvento(e))}>
            {marcas.map((m, i) => (
              <span
                key={i}
                className={`absolute text-[10px] text-ink-400 ${i === 0 ? "" : i === marcas.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
                style={{ left: pct(m) }}
              >
                {mmss(m)}
              </span>
            ))}
          </div>

          {/* vídeo */}
          <Faixa onClick={(e) => onSeek?.(tempoDoEvento(e))}>
            <div className="absolute inset-0 flex items-end gap-[1px] overflow-hidden rounded bg-ink-900/85 px-[1px]">
              {(onda ?? []).map((v, i) => (
                <span key={i} className="flex-1 rounded-sm bg-gold-400/70" style={{ height: `${Math.max(4, v * 100)}%` }} />
              ))}
              {!onda?.length && (
                <span className="w-full self-center text-center text-[10px] text-ink-400">
                  {projeto.fonte?.nome ?? "vídeo"} — use &quot;Detectar silêncio&quot; para ver a onda
                </span>
              )}
            </div>
            {projeto.cortes.map((c, i) => {
              const ini = paraLinha(projeto, c.inicio);
              return ini == null ? null : (
                <span
                  key={i}
                  title={`corte ${mmss(c.inicio)}–${mmss(c.fim)} (${(c.fim - c.inicio).toFixed(1)}s)`}
                  className="absolute top-0 h-full w-[3px] bg-rose-500"
                  style={{ left: pct(ini) }}
                />
              );
            })}
          </Faixa>

          {/* telas */}
          <Faixa onClick={(e) => onSeek?.(tempoDoEvento(e))}>
            {projeto.telas.length === 0 && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-ink-400">
                sem telas — gere ou puxe a metadinha
              </span>
            )}
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

          {/* textos na tela */}
          <Faixa onClick={(e) => onSeek?.(tempoDoEvento(e))}>
            {(projeto.textos ?? []).map((t) => {
              const ini = paraLinha(projeto, t.inicio);
              if (ini == null) return null;
              const fim = paraLinha(projeto, t.fim) ?? ini;
              const sel = selecionado?.faixa === "texto" && selecionado.id === t.id;
              return (
                <button
                  key={t.id}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onSelecionar?.({ faixa: "texto", id: t.id });
                    setArrasto({ faixa: "texto", id: t.id, x0: e.clientX });
                  }}
                  className={`absolute top-0 h-full overflow-hidden rounded px-1 text-left text-[10px] ${
                    sel ? "bg-amber-500 text-ink-900 ring-2 ring-amber-700" : "bg-amber-200 text-ink-800 hover:bg-amber-300"
                  }`}
                  style={{ left: pct(ini), width: larguraPct(ini, fim) }}
                  title={t.texto}
                >
                  {t.texto}
                </button>
              );
            })}
            {!(projeto.textos ?? []).length && (
              <span className="absolute inset-0 flex items-center px-2 text-[10px] text-ink-400">sem textos</span>
            )}
          </Faixa>

          {/* legendas */}
          <Faixa onClick={(e) => onSeek?.(tempoDoEvento(e))}>
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
                  className={`absolute top-0 h-full overflow-hidden rounded px-1 text-left text-[10px] leading-tight ${
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

          {/* trocas de layout */}
          <Faixa onClick={(e) => onSeek?.(tempoDoEvento(e))}>
            <span className="absolute inset-0 flex items-center rounded border border-dashed border-ink-200 px-2 text-[10px] text-ink-400">
              layout geral: {projeto.layout.modo}
            </span>
            {(projeto.layoutClips ?? []).map((c) => {
              const ini = paraLinha(projeto, c.inicio) ?? 0;
              const fim = paraLinha(projeto, c.fim) ?? ini;
              const sel = selecionado?.faixa === "layout" && selecionado.id === c.id;
              return (
                <button
                  key={c.id}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onSelecionar?.({ faixa: "layout", id: c.id });
                    setArrasto({ faixa: "layout", id: c.id, x0: e.clientX });
                  }}
                  className={`absolute top-0 h-full overflow-hidden rounded px-1 text-left text-[10px] ${
                    sel ? "bg-sky-500 text-white ring-2 ring-sky-700" : "bg-sky-200 text-ink-800 hover:bg-sky-300"
                  }`}
                  style={{ left: pct(ini), width: larguraPct(ini, fim) }}
                  title={`${c.modo} (${mmss(c.inicio)}–${mmss(c.fim)})`}
                >
                  {c.modo}
                </button>
              );
            })}
          </Faixa>

          {/* música */}
          <Faixa onClick={(e) => onSeek?.(tempoDoEvento(e))}>
            {projeto.musica ? (
              <div className="absolute inset-0 flex items-center rounded bg-violet-200 px-2 text-[10px] text-ink-800">
                ♪ {projeto.musica.nome || "música"} · {Math.round((projeto.musica.volume ?? 0) * 100)}%
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
    </div>
  );
}

function Faixa({ children, onClick }: { children: React.ReactNode; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <div className="relative mb-1 h-8 cursor-pointer rounded bg-ink-50" onClick={onClick}>
      {children}
    </div>
  );
}
