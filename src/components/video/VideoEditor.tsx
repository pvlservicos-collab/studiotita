"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProgressBar } from "@/components/ui";
import Timeline from "@/components/video/Timeline";
import { MotorVideo, urlDeMidia } from "@/lib/video/engine";
import { analisarSilencio, carregarAudio, ondaParaDesenho } from "@/lib/video/silence";
import { telasDoFluxo } from "@/lib/video/telas";
import {
  duracaoFinal,
  mmss,
  normalizarCortes,
  novoId,
  paraLinha,
  type VideoProject,
} from "@/lib/video/types";
import type { StudioScene } from "@/lib/studio/scenes";

type Aba = "legendas" | "cortes" | "telas" | "musica" | "layout";

interface Projeto {
  id: string;
  title: string;
  flow_id: string | null;
  source_url: string | null;
  source_name: string | null;
  duration: number | null;
  project: VideoProject;
  status: string;
}

/** O editor: prévia, linha do tempo, ferramentas e exportação. */
export default function VideoEditor({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const [row, setRow] = useState<Projeto | null>(null);
  const [projeto, setProjetoState] = useState<VideoProject | null>(null);
  const [tempo, setTempo] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [aba, setAba] = useState<Aba>("legendas");
  const [sel, setSel] = useState<{ faixa: "tela" | "legenda"; id: string } | null>(null);
  const [onda, setOnda] = useState<number[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [sujo, setSujo] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motorRef = useRef<MotorVideo | null>(null);

  // ------------------------------------------------------------- carregar
  useEffect(() => {
    fetch(`/api/video-projects/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.project) {
          setRow(d.project);
          setProjetoState(d.project.project);
        } else setErro(d.error ?? "Projeto não encontrado.");
      })
      .catch((e) => setErro(String(e)));
  }, [id]);

  // motor: cria quando o canvas e o projeto existem
  useEffect(() => {
    if (!canvasRef.current || !projeto || motorRef.current) return;
    const motor = new MotorVideo(canvasRef.current, projeto, {
      onTempo: (t) => setTempo(t),
      onFim: () => setTocando(false),
      onErro: (e) => setErro(e.message),
    });
    motorRef.current = motor;
    motor.carregarMusica().catch(() => undefined);
    motor.desenhar();
    return () => {
      motor.destruir();
      motorRef.current = null;
    };
  }, [projeto]);

  const setProjeto = useCallback((novo: VideoProject) => {
    setProjetoState(novo);
    setSujo(true);
    motorRef.current?.atualizarProjeto(novo);
  }, []);

  const mexer = useCallback(
    (fn: (p: VideoProject) => VideoProject) => {
      setProjetoState((atual) => {
        if (!atual) return atual;
        const novo = fn(structuredClone(atual));
        setSujo(true);
        motorRef.current?.atualizarProjeto(novo);
        return novo;
      });
    },
    []
  );

  // ------------------------------------------------------------- ações
  async function salvar(extra: Partial<Projeto> = {}) {
    if (!projeto || !row) return;
    setOcupado("Salvando...");
    try {
      const res = await fetch(`/api/video-projects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: projeto, title: row.title, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Erro ao salvar.");
      setRow(d.project);
      setSujo(false);
      setAviso("Projeto salvo.");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function enviarVideo(file: File | undefined) {
    if (!file || !projeto) return;
    setOcupado("Enviando o vídeo...");
    setErro(null);
    try {
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(`videos-brutos/${id}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/files/upload",
      });
      const duracao = await medirDuracao(file);
      const novo: VideoProject = {
        ...projeto,
        fonte: { url: blob.url, nome: file.name, duracao, largura: null, altura: null },
        telas: projeto.telas.length ? projeto.telas : projeto.telas,
      };
      setProjeto(novo);
      await fetch(`/api/video-projects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: novo, source_url: blob.url, source_name: file.name, duration: duracao }),
      });
      setAviso(`Vídeo carregado (${mmss(duracao)}).`);
      setOnda(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function enviarMusica(file: File | undefined) {
    if (!file || !projeto) return;
    setOcupado("Enviando a música...");
    try {
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(`musicas/${id}-${file.name}`, file, { access: "public", handleUploadUrl: "/api/files/upload" });
      mexer((p) => ({
        ...p,
        musica: { url: blob.url, nome: file.name, volume: p.musica?.volume ?? 0.22, inicioNaMusica: 0, fadeOut: 2 },
      }));
      await motorRef.current?.carregarMusica().catch(() => undefined);
      setAviso("Música adicionada.");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function detectarSilencio(opcoes: { limiar: number; minimo: number; folga: number; protegerInicio: number }) {
    if (!projeto?.fonte?.url) return setErro("Envie o vídeo primeiro.");
    setOcupado("Ouvindo o áudio...");
    setErro(null);
    try {
      const buffer = await carregarAudio(urlDeMidia(projeto.fonte.url), (p) => setProgresso(p * 0.7));
      setProgresso(0.8);
      const analise = analisarSilencio(buffer, opcoes);
      setOnda(ondaParaDesenho(analise.niveis, 400));
      mexer((p) => ({
        ...p,
        fonte: p.fonte ? { ...p.fonte, duracao: p.fonte.duracao || buffer.duration } : p.fonte,
        cortes: normalizarCortes(
          analise.cortes.map((c) => ({ ...c, motivo: "silencio" as const })),
          buffer.duration
        ),
      }));
      setAviso(
        `${analise.cortes.length} cortes de silêncio · ${analise.tempoCortado.toFixed(1)}s a menos ` +
          `(de ${mmss(buffer.duration)} para ${mmss(buffer.duration - analise.tempoCortado)}).`
      );
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
      setProgresso(0);
    }
  }

  async function gerarLegendas() {
    setOcupado("Transcrevendo com o Gemini (30 a 90s)...");
    setErro(null);
    try {
      const res = await fetch(`/api/video-projects/${id}/legendas`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Erro ao gerar legendas.");
      setRow(d.project);
      setProjetoState(d.project.project);
      motorRef.current?.atualizarProjeto(d.project.project);
      setAviso(`${d.legendas} legendas geradas.`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function puxarTelas() {
    if (!row?.flow_id || !projeto) return setErro("Este projeto não está ligado a uma metadinha.");
    setOcupado("Buscando as telas...");
    try {
      const res = await fetch(`/api/studio-flows/${row.flow_id}`);
      const d = await res.json();
      const cenas = (d.flow?.scenes as StudioScene[]) ?? [];
      mexer((p) => ({ ...p, telas: telasDoFluxo(cenas, p.fonte?.duracao ?? 0) }));
      setAviso(`${cenas.length} telas trazidas da metadinha.`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function exportar() {
    const motor = motorRef.current;
    if (!motor) return;
    setOcupado("Gravando o vídeo (roda em tempo real, não feche a aba)...");
    setErro(null);
    try {
      const { blob, extensao } = await motor.exportar((p) => setProgresso(p));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(row?.title ?? "video").replace(/[^\w\d\- ]+/g, "").slice(0, 50) || "video"}.${extensao}`;
      a.click();
      URL.revokeObjectURL(url);
      setAviso(`Vídeo exportado (${(blob.size / 1024 / 1024).toFixed(1)} MB).`);
      salvar({ status: "exportado" } as Partial<Projeto>);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
      setProgresso(0);
      setTocando(false);
    }
  }

  function tocarPausar() {
    const motor = motorRef.current;
    if (!motor) return;
    if (tocando) {
      motor.pausar();
      setTocando(false);
    } else {
      motor.tocar();
      setTocando(true);
    }
  }

  const dur = projeto ? duracaoFinal(projeto) : 0;
  const cortado = (projeto?.fonte?.duracao ?? 0) - dur;

  if (erro && !projeto) return <p className="text-sm text-rose-600">{erro}</p>;
  if (!projeto || !row) return <p className="text-sm text-ink-400">Carregando o projeto...</p>;

  return (
    <div className="space-y-3">
      {/* cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={onVoltar} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">
            ← Vídeos
          </button>
          <input
            value={row.title}
            onChange={(e) => {
              setRow({ ...row, title: e.target.value });
              setSujo(true);
            }}
            className="min-w-[200px] rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-ink-900 hover:border-ink-200 focus:border-gold-400 focus:outline-none"
          />
          {sujo && <span className="text-[11px] text-amber-600">alterações não salvas</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => salvar()}
            disabled={!!ocupado}
            className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            Salvar
          </button>
          <button
            onClick={exportar}
            disabled={!!ocupado || !projeto.fonte?.url}
            className="btn-gold rounded-lg px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
            title="Grava a linha do tempo inteira e baixa o arquivo"
          >
            ⬇ Exportar vídeo
          </button>
        </div>
      </div>

      {(ocupado || aviso || erro) && (
        <div className="space-y-1 rounded-xl bg-white/70 px-3 py-2">
          {ocupado && (
            <>
              <div className="text-xs text-ink-600">{ocupado}</div>
              <ProgressBar progress={progresso * 100} indeterminate={!progresso} />
            </>
          )}
          {!ocupado && aviso && <div className="text-xs text-emerald-700">{aviso}</div>}
          {erro && <div className="text-xs text-rose-600">{erro}</div>}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row">
        {/* prévia */}
        <div className="lg:w-[320px] lg:shrink-0">
          <div className="overflow-hidden rounded-xl bg-black shadow-glass">
            <canvas ref={canvasRef} className="block h-auto w-full" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button onClick={tocarPausar} disabled={!projeto.fonte?.url} className="btn-gold rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
              {tocando ? "⏸ Pausar" : "▶ Tocar"}
            </button>
            <span className="font-mono text-xs text-ink-600">
              {mmss(tempo)} / {mmss(dur)}
            </span>
            {cortado > 0.5 && <span className="text-[11px] text-rose-600">−{cortado.toFixed(1)}s cortados</span>}
          </div>
          {!projeto.fonte?.url && (
            <label className="mt-2 block cursor-pointer rounded-xl border border-dashed border-gold-300 bg-gold-50/50 px-3 py-4 text-center text-xs text-ink-600 hover:bg-gold-50">
              <strong className="text-gold-700">Enviar o vídeo do Augusto</strong>
              <div className="mt-0.5 text-[11px] text-ink-400">mp4 ou mov, até 200 MB</div>
              <input type="file" accept="video/*" className="hidden" onChange={(e) => enviarVideo(e.target.files?.[0])} />
            </label>
          )}
        </div>

        {/* ferramentas */}
        <div className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-white/70 p-3">
          <div className="mb-3 flex flex-wrap gap-1">
            {(
              [
                ["legendas", `Legendas (${projeto.legendas.length})`],
                ["cortes", `Cortes (${projeto.cortes.length})`],
                ["telas", `Telas (${projeto.telas.length})`],
                ["musica", "Música"],
                ["layout", "Layout"],
              ] as [Aba, string][]
            ).map(([k, rotulo]) => (
              <button
                key={k}
                onClick={() => setAba(k)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${aba === k ? "btn-gold" : "bg-ink-100 text-ink-600 hover:bg-ink-200"}`}
              >
                {rotulo}
              </button>
            ))}
          </div>

          {aba === "legendas" && (
            <PainelLegendas projeto={projeto} mexer={mexer} sel={sel} onSel={setSel} onGerar={gerarLegendas} ocupado={!!ocupado} onIr={(t) => motorRef.current?.irPara(t)} />
          )}
          {aba === "cortes" && <PainelCortes projeto={projeto} mexer={mexer} onDetectar={detectarSilencio} ocupado={!!ocupado} />}
          {aba === "telas" && <PainelTelas projeto={projeto} mexer={mexer} sel={sel} onSel={setSel} onPuxar={puxarTelas} ocupado={!!ocupado} onIr={(t) => motorRef.current?.irPara(t)} />}
          {aba === "musica" && <PainelMusica projeto={projeto} mexer={mexer} onEnviar={enviarMusica} ocupado={!!ocupado} />}
          {aba === "layout" && <PainelLayout projeto={projeto} mexer={mexer} onTrocarVideo={enviarVideo} />}
        </div>
      </div>

      <Timeline
        projeto={projeto}
        tempo={tempo}
        onda={onda}
        selecionado={sel}
        onSelecionar={setSel}
        onSeek={(t) => motorRef.current?.irPara(t)}
        onMover={(faixa, idClip, delta) =>
          mexer((p) => {
            if (faixa === "tela") {
              p.telas = p.telas.map((t) => (t.id === idClip ? { ...t, inicio: Math.max(0, t.inicio + delta), fim: Math.max(0.5, t.fim + delta) } : t));
            } else {
              p.legendas = p.legendas.map((l) => (l.id === idClip ? { ...l, inicio: Math.max(0, l.inicio + delta), fim: Math.max(0.3, l.fim + delta) } : l));
            }
            return p;
          })
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------- painéis

const campo = "w-full rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-gold-400";

function PainelLegendas({
  projeto,
  mexer,
  sel,
  onSel,
  onGerar,
  ocupado,
  onIr,
}: {
  projeto: VideoProject;
  mexer: (fn: (p: VideoProject) => VideoProject) => void;
  sel: { faixa: string; id: string } | null;
  onSel: (s: { faixa: "tela" | "legenda"; id: string } | null) => void;
  onGerar: () => void;
  ocupado: boolean;
  onIr: (t: number) => void;
}) {
  const e = projeto.legendaEstilo;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onGerar} disabled={ocupado} className="rounded-lg border border-gold-300 bg-white px-3 py-1.5 text-xs font-semibold text-gold-700 hover:bg-gold-50 disabled:opacity-50">
          ✦ Gerar legendas do áudio (Gemini)
        </button>
        <button
          onClick={() => mexer((p) => ({ ...p, legendas: [] }))}
          className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50"
        >
          Limpar
        </button>
        <span className="text-[11px] text-ink-400">quando o vídeo já tem análise, as legendas vêm da transcrição na criação</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-[11px] text-ink-500">
          Tamanho
          <input type="number" value={e.tamanho} className={campo} onChange={(ev) => mexer((p) => ({ ...p, legendaEstilo: { ...p.legendaEstilo, tamanho: Number(ev.target.value) || 40 } }))} />
        </label>
        <label className="text-[11px] text-ink-500">
          Posição
          <select value={e.posicao} className={campo} onChange={(ev) => mexer((p) => ({ ...p, legendaEstilo: { ...p.legendaEstilo, posicao: ev.target.value as any } }))}>
            <option value="rodape">rodapé</option>
            <option value="centro">centro</option>
            <option value="topo">topo</option>
          </select>
        </label>
        <label className="text-[11px] text-ink-500">
          Cor
          <input type="color" value={e.cor} className="h-7 w-full rounded-lg border border-ink-200" onChange={(ev) => mexer((p) => ({ ...p, legendaEstilo: { ...p.legendaEstilo, cor: ev.target.value } }))} />
        </label>
        <label className="flex items-end gap-2 text-[11px] text-ink-500">
          <input type="checkbox" checked={e.maiusculas} className="accent-gold-600" onChange={(ev) => mexer((p) => ({ ...p, legendaEstilo: { ...p.legendaEstilo, maiusculas: ev.target.checked } }))} />
          MAIÚSCULAS
        </label>
      </div>

      <div className="max-h-56 space-y-1 overflow-y-auto">
        {projeto.legendas.length === 0 && <p className="text-xs text-ink-400">Sem legendas ainda.</p>}
        {projeto.legendas.map((l) => (
          <div
            key={l.id}
            className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${sel?.id === l.id ? "border-emerald-400 bg-emerald-50" : "border-ink-100"}`}
            onClick={() => {
              onSel({ faixa: "legenda", id: l.id });
              const tl = paraLinha(projeto, l.inicio);
              if (tl != null) onIr(tl);
            }}
          >
            <span className="w-20 shrink-0 font-mono text-[10px] text-ink-400">
              {mmss(l.inicio)}–{mmss(l.fim)}
            </span>
            <input
              value={l.texto}
              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-ink-200 focus:border-gold-400 focus:outline-none"
              onChange={(ev) => mexer((p) => ({ ...p, legendas: p.legendas.map((x) => (x.id === l.id ? { ...x, texto: ev.target.value } : x)) }))}
            />
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                mexer((p) => ({ ...p, legendas: p.legendas.filter((x) => x.id !== l.id) }));
              }}
              className="text-xs text-ink-400 hover:text-rose-600"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PainelCortes({
  projeto,
  mexer,
  onDetectar,
  ocupado,
}: {
  projeto: VideoProject;
  mexer: (fn: (p: VideoProject) => VideoProject) => void;
  onDetectar: (o: { limiar: number; minimo: number; folga: number; protegerInicio: number }) => void;
  ocupado: boolean;
}) {
  const [limiar, setLimiar] = useState(-45);
  const [minimo, setMinimo] = useState(0.35);
  const [folga, setFolga] = useState(0.08);
  const [protegerInicio, setProteger] = useState(0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">
        O sistema ouve o áudio e corta os trechos em silêncio. Nada é apagado do arquivo: os cortes ficam na linha do tempo e dá para
        limpar quando quiser.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-[11px] text-ink-500">
          Silêncio abaixo de (dB)
          <input type="number" value={limiar} className={campo} onChange={(e) => setLimiar(Number(e.target.value))} />
        </label>
        <label className="text-[11px] text-ink-500">
          Pausa mínima (s)
          <input type="number" step="0.05" value={minimo} className={campo} onChange={(e) => setMinimo(Number(e.target.value))} />
        </label>
        <label className="text-[11px] text-ink-500">
          Folga nas pontas (s)
          <input type="number" step="0.01" value={folga} className={campo} onChange={(e) => setFolga(Number(e.target.value))} />
        </label>
        <label className="text-[11px] text-ink-500">
          Não cortar os primeiros (s)
          <input type="number" step="0.5" value={protegerInicio} className={campo} onChange={(e) => setProteger(Number(e.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onDetectar({ limiar, minimo, folga, protegerInicio })}
          disabled={ocupado || !projeto.fonte?.url}
          className="btn-gold rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          ✂ Detectar silêncio
        </button>
        <button onClick={() => mexer((p) => ({ ...p, cortes: [] }))} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">
          Limpar cortes
        </button>
      </div>
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {projeto.cortes.map((c, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-ink-100 px-2 py-1 text-xs">
            <span className="font-mono text-[10px] text-ink-500">
              {mmss(c.inicio)} → {mmss(c.fim)}
            </span>
            <span className="text-[10px] text-ink-400">{(c.fim - c.inicio).toFixed(2)}s · {c.motivo ?? "manual"}</span>
            <button
              onClick={() => mexer((p) => ({ ...p, cortes: p.cortes.filter((_, k) => k !== i) }))}
              className="ml-auto text-ink-400 hover:text-rose-600"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PainelTelas({
  projeto,
  mexer,
  sel,
  onSel,
  onPuxar,
  ocupado,
  onIr,
}: {
  projeto: VideoProject;
  mexer: (fn: (p: VideoProject) => VideoProject) => void;
  sel: { faixa: string; id: string } | null;
  onSel: (s: { faixa: "tela" | "legenda"; id: string } | null) => void;
  onPuxar: () => void;
  ocupado: boolean;
  onIr: (t: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onPuxar} disabled={ocupado} className="rounded-lg border border-gold-300 bg-white px-3 py-1.5 text-xs font-semibold text-gold-700 hover:bg-gold-50 disabled:opacity-50">
          ↻ Puxar telas da metadinha
        </button>
        <button
          onClick={() =>
            mexer((p) => {
              const dur = p.fonte?.duracao ?? 60;
              const fatia = dur / Math.max(1, p.telas.length);
              return { ...p, telas: p.telas.map((t, i) => ({ ...t, inicio: Number((i * fatia).toFixed(2)), fim: Number(((i + 1) * fatia).toFixed(2)) })) };
            })
          }
          className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50"
        >
          Distribuir no vídeo todo
        </button>
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {projeto.telas.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${sel?.id === t.id ? "border-gold-400 bg-gold-50" : "border-ink-100"}`}
            onClick={() => {
              onSel({ faixa: "tela", id: t.id });
              const tl = paraLinha(projeto, t.inicio);
              if (tl != null) onIr(tl);
            }}
          >
            <input
              type="number"
              step="0.5"
              value={t.inicio}
              className="w-16 rounded border border-ink-200 px-1 py-0.5 text-[11px]"
              onChange={(ev) => mexer((p) => ({ ...p, telas: p.telas.map((x) => (x.id === t.id ? { ...x, inicio: Number(ev.target.value) } : x)) }))}
            />
            <input
              type="number"
              step="0.5"
              value={t.fim}
              className="w-16 rounded border border-ink-200 px-1 py-0.5 text-[11px]"
              onChange={(ev) => mexer((p) => ({ ...p, telas: p.telas.map((x) => (x.id === t.id ? { ...x, fim: Number(ev.target.value) } : x)) }))}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-ink-700">
              {t.cena.titulo ?? t.cena.tipo} <span className="text-[10px] text-ink-400">· {t.cena.tipo}</span>
            </span>
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                mexer((p) => ({ ...p, telas: p.telas.filter((x) => x.id !== t.id) }));
              }}
              className="text-xs text-ink-400 hover:text-rose-600"
            >
              ✕
            </button>
          </div>
        ))}
        {!projeto.telas.length && <p className="text-xs text-ink-400">Nenhuma tela. Puxe as telas da metadinha ligada a este projeto.</p>}
      </div>
    </div>
  );
}

function PainelMusica({
  projeto,
  mexer,
  onEnviar,
  ocupado,
}: {
  projeto: VideoProject;
  mexer: (fn: (p: VideoProject) => VideoProject) => void;
  onEnviar: (f: File | undefined) => void;
  ocupado: boolean;
}) {
  const m = projeto.musica;
  return (
    <div className="space-y-3">
      <label className="inline-block cursor-pointer rounded-lg border border-gold-300 bg-white px-3 py-1.5 text-xs font-semibold text-gold-700 hover:bg-gold-50">
        {m ? "Trocar música" : "♪ Enviar música"}
        <input type="file" accept="audio/*" className="hidden" disabled={ocupado} onChange={(e) => onEnviar(e.target.files?.[0])} />
      </label>
      {m && (
        <>
          <div className="text-xs text-ink-600">{m.nome}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="text-[11px] text-ink-500">
              Volume ({Math.round(m.volume * 100)}%)
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={m.volume}
                className="w-full accent-gold-600"
                onChange={(e) => mexer((p) => ({ ...p, musica: p.musica ? { ...p.musica, volume: Number(e.target.value) } : p.musica }))}
              />
            </label>
            <label className="text-[11px] text-ink-500">
              Começar a música em (s)
              <input
                type="number"
                step="0.5"
                value={m.inicioNaMusica}
                className={campo}
                onChange={(e) => mexer((p) => ({ ...p, musica: p.musica ? { ...p.musica, inicioNaMusica: Number(e.target.value) } : p.musica }))}
              />
            </label>
            <label className="text-[11px] text-ink-500">
              Fade no fim (s)
              <input
                type="number"
                step="0.5"
                value={m.fadeOut}
                className={campo}
                onChange={(e) => mexer((p) => ({ ...p, musica: p.musica ? { ...p.musica, fadeOut: Number(e.target.value) } : p.musica }))}
              />
            </label>
          </div>
          <button onClick={() => mexer((p) => ({ ...p, musica: null }))} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">
            Tirar música
          </button>
        </>
      )}
      <label className="block text-[11px] text-ink-500">
        Volume da fala ({Math.round((projeto.volumeFonte ?? 1) * 100)}%)
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.05}
          value={projeto.volumeFonte}
          className="w-full accent-gold-600"
          onChange={(e) => mexer((p) => ({ ...p, volumeFonte: Number(e.target.value) }))}
        />
      </label>
    </div>
  );
}

function PainelLayout({
  projeto,
  mexer,
  onTrocarVideo,
}: {
  projeto: VideoProject;
  mexer: (fn: (p: VideoProject) => VideoProject) => void;
  onTrocarVideo: (f: File | undefined) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-[11px] text-ink-500">
          Formato do quadro
          <select
            value={projeto.layout.modo}
            className={campo}
            onChange={(e) => mexer((p) => ({ ...p, layout: { ...p.layout, modo: e.target.value as any } }))}
          >
            <option value="metadinha">Metadinha (vídeo em cima, tela embaixo)</option>
            <option value="cheio">Vídeo cheio (tela como card embaixo)</option>
            <option value="tela">Só a tela do estúdio</option>
          </select>
        </label>
        <label className="text-[11px] text-ink-500">
          Divisão ({Math.round(projeto.layout.divisao * 100)}% vídeo)
          <input
            type="range"
            min={0.2}
            max={0.8}
            step={0.01}
            value={projeto.layout.divisao}
            className="w-full accent-gold-600"
            onChange={(e) => mexer((p) => ({ ...p, layout: { ...p.layout, divisao: Number(e.target.value) } }))}
          />
        </label>
        <label className="text-[11px] text-ink-500">
          Fundo
          <input
            type="color"
            value={projeto.layout.fundo}
            className="h-7 w-full rounded-lg border border-ink-200"
            onChange={(e) => mexer((p) => ({ ...p, layout: { ...p.layout, fundo: e.target.value } }))}
          />
        </label>
        <label className="text-[11px] text-ink-500">
          Quadros por segundo
          <input type="number" value={projeto.fps} className={campo} onChange={(e) => mexer((p) => ({ ...p, fps: Number(e.target.value) || 30 }))} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50">
          Trocar o vídeo do Augusto
          <input type="file" accept="video/*" className="hidden" onChange={(e) => onTrocarVideo(e.target.files?.[0])} />
        </label>
        <span className="text-[11px] text-ink-400">
          {projeto.fonte?.nome ? `${projeto.fonte.nome} · ${mmss(projeto.fonte.duracao)}` : "nenhum vídeo enviado"}
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ ajuda

function medirDuracao(file: File) {
  return new Promise<number>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      resolve(Number.isFinite(v.duration) ? v.duration : 0);
      URL.revokeObjectURL(v.src);
    };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}
