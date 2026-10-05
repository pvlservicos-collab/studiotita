"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProgressBar } from "@/components/ui";
import Timeline from "@/components/video/Timeline";
import { MotorVideo, urlDeMidia } from "@/lib/video/engine";
import { analisarSilencio, carregarAudio, ondaParaDesenho } from "@/lib/video/silence";
import { telasDoFluxo } from "@/lib/video/telas";
import { FONTES } from "@/lib/video/fonts";
import {
  LAYOUTS,
  duracaoFinal,
  mmss,
  normalizarCortes,
  novoId,
  paraFonte,
  paraLinha,
  textoPadrao,
  type LayoutModo,
  type TextoClip,
  type VideoProject,
} from "@/lib/video/types";
import type { StudioScene } from "@/lib/studio/scenes";
import type { StudioFlowRow, VideoRow } from "@/lib/types";

interface Projeto {
  id: string;
  title: string;
  flow_id: string | null;
  source_url: string | null;
  source_name: string | null;
  duration: number | null;
  project: VideoProject;
  status: string;
  export_url?: string | null;
  render_status?: "parado" | "na_fila" | "renderizando" | "pronto" | "erro";
  render_progress?: number | string;
  render_etapa?: string | null;
  render_error?: string | null;
  render_ms?: number | null;
}

type Selecao = { faixa: "tela" | "legenda" | "layout" | "texto"; id: string } | null;

/** O editor: prévia, linha do tempo e todas as opções, uma abaixo da outra. */
export default function VideoEditor({
  id,
  onVoltar,
  onAbrir,
  onNovo,
}: {
  id: string;
  onVoltar: () => void;
  onAbrir?: (id: string) => void;
  onNovo?: () => void;
}) {
  const [row, setRow] = useState<Projeto | null>(null);
  const [projeto, setProjetoState] = useState<VideoProject | null>(null);
  const [tempo, setTempo] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [sel, setSel] = useState<Selecao>(null);
  const [onda, setOnda] = useState<number[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [sujo, setSujo] = useState(false);
  const [salvamento, setSalvamento] = useState<"limpo" | "salvando" | "salvo" | "erro">("limpo");
  const [marcaA, setMarcaA] = useState<number | null>(null);
  const [projetos, setProjetos] = useState<{ id: string; title: string }[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motorRef = useRef<MotorVideo | null>(null);
  /** espelhos: o motor nasce com o estado certo e o autosave sempre salva o atual */
  const projetoRef = useRef<VideoProject | null>(null);
  projetoRef.current = projeto;
  const tituloRef = useRef<string>("");
  tituloRef.current = row?.title ?? "";

  useEffect(() => {
    fetch(`/api/video-projects/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.project) {
          const linha = d.project as Projeto;
          const proj: VideoProject = linha.project;
          // conserto: projeto salvo antes de o arquivo entrar no JSON (o vídeo
          // ficava só nas colunas e a prévia abria vazia)
          if (!proj.fonte?.url && linha.source_url) {
            proj.fonte = {
              url: linha.source_url,
              nome: linha.source_name,
              duracao: Number(linha.duration ?? 0),
              largura: null,
              altura: null,
            };
          }
          setRow(linha);
          setProjetoState(proj);
        } else setErro(d.error ?? "Projeto não encontrado.");
      })
      .catch((e) => setErro(String(e)));
  }, [id]);

  // O motor é criado UMA vez. Antes ele era recriado a cada alteração e o
  // vídeo sumia da prévia enquanto o arquivo carregava de novo.
  const temProjeto = !!projeto;
  useEffect(() => {
    if (!temProjeto || motorRef.current || !canvasRef.current) return;
    const motor = new MotorVideo(canvasRef.current, projetoRef.current!, {
      onTempo: (t) => setTempo(t),
      onFim: () => setTocando(false),
      onErro: (e) => setErro(e.message),
    });
    motorRef.current = motor;
    motor.carregarMusica().catch(() => undefined);
    motor.desenhar();
    // quando os metadados do vídeo chegam, redesenha (senão fica o fundo)
    motor.video.addEventListener("loadeddata", () => motor.desenhar());
    return () => {
      motor.destruir();
      motorRef.current = null;
    };
  }, [temProjeto]);


  const mexer = useCallback((fn: (p: VideoProject) => VideoProject) => {
    setProjetoState((atual) => {
      if (!atual) return atual;
      const novo = fn(structuredClone(atual));
      setSujo(true);
      motorRef.current?.atualizarProjeto(novo);
      return novo;
    });
  }, []);

  // ------------------------------------------------------------- ações
  /**
   * Salva a linha do tempo no banco. No modo automático não trava a tela nem
   * mostra aviso: só o selo de "salvando/salvo" no cabeçalho.
   */
  const salvar = useCallback(
    async (extra: Record<string, unknown> = {}, automatico = false) => {
      const atual = projetoRef.current;
      const titulo = tituloRef.current;
      if (!atual) return;
      if (!automatico) setOcupado("Salvando...");
      setSalvamento("salvando");
      try {
        const res = await fetch(`/api/video-projects/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ project: atual, title: titulo, ...extra }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Erro ao salvar.");
        setRow((r) => (r ? { ...r, ...d.project } : d.project));
        setSujo(false);
        setSalvamento("salvo");
        if (!automatico) setAviso("Projeto salvo.");
      } catch (e) {
        setSalvamento("erro");
        setErro((e as Error).message);
      } finally {
        if (!automatico) setOcupado(null);
      }
    },
    [id]
  );

  // salvamento automático: 1,2s depois da última mexida
  useEffect(() => {
    if (!sujo || !projeto) return;
    const t = setTimeout(() => salvar({}, true), 1200);
    return () => clearTimeout(t);
  }, [sujo, projeto, salvar]);

  // se ainda houver coisa não salva, avisa antes de sair
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (!sujo) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sujo]);

  // lista de projetos para o menu "abrir"
  useEffect(() => {
    fetch("/api/video-projects")
      .then((r) => r.json())
      .then((d) => setProjetos((d.projects ?? []).map((p: any) => ({ id: p.id, title: p.title }))))
      .catch(() => undefined);
  }, [id]);

  async function enviarVideo(file: File | undefined) {
    if (!file || !projeto) return;
    setOcupado("Enviando o vídeo...");
    setErro(null);
    try {
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(`videos-brutos/${id}-${file.name}`, file, { access: "public", handleUploadUrl: "/api/files/upload" });
      const duracao = await medirDuracao(file);
      const novo = {
        ...(projetoRef.current ?? projeto),
        fonte: { url: blob.url, nome: file.name, duracao, largura: null, altura: null },
      } as VideoProject;
      setProjetoState(novo);
      motorRef.current?.atualizarProjeto(novo);
      // o arquivo vai junto DENTRO do projeto: era isso que se perdia ao
      // recarregar a página (o vídeo ficava só nas colunas)
      await fetch(`/api/video-projects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: novo, source_url: blob.url, source_name: file.name, duration: duracao }),
      });
      setSujo(false);
      setSalvamento("salvo");
      setOnda(null);
      setAviso(`Vídeo carregado (${mmss(duracao)}).`);
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
      mexer((p) => ({ ...p, musica: { url: blob.url, nome: file.name, volume: p.musica?.volume ?? 0.22, inicioNaMusica: 0, fadeOut: 2 } }));
      await motorRef.current?.carregarMusica().catch(() => undefined);
      setAviso("Música adicionada.");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function detectarSilencio(o: { limiar: number; minimo: number; folga: number; protegerInicio: number }) {
    if (!projeto?.fonte?.url) return setErro("Envie o vídeo primeiro.");
    setOcupado("Ouvindo o áudio...");
    setErro(null);
    try {
      const buffer = await carregarAudio(urlDeMidia(projeto.fonte.url), (p) => setProgresso(p * 0.7));
      setProgresso(0.85);
      const analise = analisarSilencio(buffer, o);
      setOnda(ondaParaDesenho(analise.niveis, 400));
      mexer((p) => ({
        ...p,
        fonte: p.fonte ? { ...p.fonte, duracao: p.fonte.duracao || buffer.duration } : p.fonte,
        cortes: normalizarCortes(
          [...p.cortes.filter((c) => c.motivo === "manual"), ...analise.cortes.map((c) => ({ ...c, motivo: "silencio" as const }))],
          buffer.duration
        ),
      }));
      setAviso(
        `${analise.cortes.length} cortes de silêncio · ${analise.tempoCortado.toFixed(1)}s a menos (de ${mmss(buffer.duration)} para ${mmss(
          buffer.duration - analise.tempoCortado
        )}).`
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

  /** Traz as telas de um fluxo já existente. */
  async function usarFluxo(flowId: string) {
    setOcupado("Buscando as telas...");
    setErro(null);
    try {
      const d = await fetch(`/api/studio-flows/${flowId}`).then((r) => r.json());
      const cenas = (d.flow?.scenes as StudioScene[]) ?? [];
      if (!cenas.length) throw new Error("Esta metadinha está sem cenas.");
      mexer((p) => ({ ...p, telas: telasDoFluxo(cenas, p.fonte?.duracao ?? 0) }));
      await fetch(`/api/video-projects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flow_id: flowId }),
      });
      setRow((r) => (r ? { ...r, flow_id: flowId } : r));
      setAviso(`${cenas.length} telas trazidas.`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  /** Manda o sistema montar uma metadinha nova a partir da análise de um vídeo. */
  async function gerarMetadinha(videoId: string) {
    setOcupado("Montando a metadinha com o Gemini (30 a 60s)...");
    setErro(null);
    try {
      const res = await fetch("/api/studio-flows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ video_id: videoId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Erro ao montar a metadinha.");
      await usarFluxo(d.flow.id);
      setAviso(`Metadinha "${d.flow.title}" montada e aplicada.`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  /** Manda renderizar no servidor e acompanha até terminar. */
  async function renderizarNoServidor() {
    if (!projeto?.fonte?.url) return setErro("Envie o vídeo primeiro.");
    if (sujo) await salvar({}, true);
    setErro(null);
    try {
      const res = await fetch(`/api/video-projects/${id}/render`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Erro ao começar o render.");
      setRow((r) => (r ? { ...r, ...d.project } : r));
      acompanharRender();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const acompanharRender = useCallback(() => {
    const tick = async () => {
      try {
        const d = await fetch(`/api/video-projects/${id}`).then((r) => r.json());
        const linha = d.project as Projeto | undefined;
        if (!linha) return;
        setRow((r) => (r ? { ...r, ...linha, project: r.project } : linha));
        if (linha.render_status === "renderizando" || linha.render_status === "na_fila") {
          setTimeout(tick, 3000);
        } else if (linha.render_status === "pronto") {
          setAviso(`Vídeo pronto no servidor${linha.render_ms ? ` em ${(linha.render_ms / 1000).toFixed(0)}s` : ""}.`);
        } else if (linha.render_status === "erro") {
          setErro(linha.render_error ?? "Erro no render do servidor.");
        }
      } catch {
        setTimeout(tick, 5000);
      }
    };
    tick();
  }, [id]);

  // se a página abrir com um render em andamento, continua acompanhando
  useEffect(() => {
    if (row?.render_status === "renderizando" || row?.render_status === "na_fila") acompanharRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.render_status === "renderizando" || row?.render_status === "na_fila"]);

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
      salvar({ status: "exportado" });
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

  /** Corta do ponto marcado até a agulha (tempos do vídeo original). */
  function cortarTrecho() {
    if (!projeto || marcaA == null) return;
    const a = paraFonte(projeto, Math.min(marcaA, tempo));
    const b = paraFonte(projeto, Math.max(marcaA, tempo));
    if (b - a < 0.1) return setErro("O trecho é curto demais.");
    mexer((p) => ({
      ...p,
      cortes: normalizarCortes([...p.cortes, { inicio: a, fim: b, motivo: "manual" }], p.fonte?.duracao ?? b),
    }));
    setMarcaA(null);
    setAviso(`Trecho cortado (${(b - a).toFixed(1)}s).`);
  }

  const renderizando = row?.render_status === "renderizando" || row?.render_status === "na_fila";
  const dur = projeto ? duracaoFinal(projeto) : 0;
  const cortado = (projeto?.fonte?.duracao ?? 0) - dur;

  if (erro && !projeto) return <p className="text-sm text-rose-600">{erro}</p>;
  if (!projeto || !row) return <p className="text-sm text-ink-400">Carregando o projeto...</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button onClick={onVoltar} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">
            ← Meus vídeos
          </button>
          {projetos.length > 1 && (
            <select
              value={id}
              onChange={(e) => e.target.value !== id && onAbrir?.(e.target.value)}
              className="max-w-[180px] rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-600"
              title="Abrir outro projeto"
            >
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}
          <input
            value={row.title}
            onChange={(e) => {
              setRow({ ...row, title: e.target.value });
              setSujo(true);
            }}
            className="min-w-[200px] rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-ink-900 hover:border-ink-200 focus:border-gold-400 focus:outline-none"
          />
          <span className="text-[11px] text-ink-400">
            {salvamento === "salvando" ? "salvando..." : salvamento === "erro" ? <span className="text-rose-600">erro ao salvar</span> : sujo ? "alterações pendentes" : salvamento === "salvo" ? "tudo salvo ✓" : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onNovo?.()} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">
            + Novo projeto
          </button>
          <button onClick={() => salvar()} disabled={!!ocupado} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50">
            Salvar agora
          </button>
          <button
            onClick={renderizarNoServidor}
            disabled={!!ocupado || !projeto.fonte?.url || renderizando}
            title="O servidor monta o mp4 (mais rápido que tempo real e sem precisar deixar a aba aberta)"
            className="btn-gold rounded-lg px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {renderizando ? `Renderizando ${Math.round(Number(row.render_progress ?? 0) * 100)}%` : "⚙ Renderizar no servidor"}
          </button>
          {row.export_url && row.render_status === "pronto" && (
            <a href={row.export_url} target="_blank" rel="noopener noreferrer" download className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
              ⬇ Baixar mp4
            </a>
          )}
          <button onClick={exportar} disabled={!!ocupado || !projeto.fonte?.url} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 disabled:opacity-50">
            Gravar aqui no navegador
          </button>
        </div>
      </div>

      {renderizando && (
        <div className="space-y-1 rounded-xl border border-gold-200 bg-gold-50/60 px-3 py-2">
          <div className="text-xs text-ink-700">
            Renderizando no servidor{row.render_etapa ? ` · ${row.render_etapa}` : ""} — pode fechar a aba, o servidor continua.
          </div>
          <ProgressBar progress={Number(row.render_progress ?? 0) * 100} indeterminate={!Number(row.render_progress ?? 0)} />
        </div>
      )}

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
        {/* prévia + transporte (grudada no topo no computador) */}
        <div className="lg:w-[300px] lg:shrink-0">
          <div className="lg:sticky lg:top-24">
            <div className="mx-auto overflow-hidden rounded-xl bg-black shadow-glass" style={{ maxWidth: "min(100%, calc(46vh * 9 / 16))" }}>
              <canvas ref={canvasRef} className="block h-auto w-full lg:max-h-none" style={{ maxHeight: "46vh" }} />
            </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={tocarPausar} disabled={!projeto.fonte?.url} className="btn-gold rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
              {tocando ? "⏸ Pausar" : "▶ Tocar"}
            </button>
            <span className="font-mono text-xs text-ink-600">
              {mmss(tempo)} / {mmss(dur)}
            </span>
            {cortado > 0.5 && <span className="text-[11px] text-rose-600">−{cortado.toFixed(1)}s</span>}
          </div>
            {!projeto.fonte?.url && (
              <label className="mt-2 block cursor-pointer rounded-xl border border-dashed border-gold-300 bg-gold-50/50 px-3 py-4 text-center text-xs text-ink-600 hover:bg-gold-50">
                <strong className="text-gold-700">Enviar o vídeo do Augusto</strong>
                <div className="mt-0.5 text-[11px] text-ink-400">mp4 ou mov, até 200 MB</div>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => enviarVideo(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>

        {/* opções, uma abaixo da outra */}
        <div className="min-w-0 flex-1 space-y-3">
          <Secao titulo="Metadinha (telas do estúdio)" resumo={`${projeto.telas.length} telas`}>
            <PainelMetadinha
              projeto={projeto}
              flowId={row.flow_id}
              mexer={mexer}
              sel={sel}
              onSel={setSel}
              onUsarFluxo={usarFluxo}
              onGerar={gerarMetadinha}
              ocupado={!!ocupado}
              onIr={(t) => motorRef.current?.irPara(t)}
            />
          </Secao>

          <Secao titulo="Layout do vídeo" resumo={LAYOUTS.find((l) => l.id === projeto.layout.modo)?.nome ?? projeto.layout.modo}>
            <PainelLayout projeto={projeto} mexer={mexer} tempo={tempo} onTrocarVideo={enviarVideo} sel={sel} onSel={setSel} />
          </Secao>

          <Secao titulo="Cortes" resumo={`${projeto.cortes.length} cortes · −${cortado.toFixed(1)}s`}>
            <PainelCortes
              projeto={projeto}
              mexer={mexer}
              onDetectar={detectarSilencio}
              ocupado={!!ocupado}
              tempo={tempo}
              marcaA={marcaA}
              onMarcar={() => setMarcaA(tempo)}
              onCortar={cortarTrecho}
              onLimparMarca={() => setMarcaA(null)}
            />
          </Secao>

          <Secao titulo="Textos na tela" resumo={`${(projeto.textos ?? []).length} textos`}>
            <PainelTextos
              projeto={projeto}
              mexer={mexer}
              tempo={tempo}
              sel={sel}
              onSel={setSel}
              onIr={(t) => motorRef.current?.irPara(t)}
            />
          </Secao>

          <Secao titulo="Legendas" resumo={`${projeto.legendas.length} legendas`}>
            <PainelLegendas projeto={projeto} mexer={mexer} sel={sel} onSel={setSel} onGerar={gerarLegendas} ocupado={!!ocupado} onIr={(t) => motorRef.current?.irPara(t)} />
          </Secao>

          <Secao titulo="Música e áudio" resumo={projeto.musica?.nome ?? "sem música"}>
            <PainelMusica projeto={projeto} mexer={mexer} onEnviar={enviarMusica} ocupado={!!ocupado} />
          </Secao>
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
            } else if (faixa === "texto") {
              p.textos = (p.textos ?? []).map((t) =>
                t.id === idClip ? { ...t, inicio: Math.max(0, t.inicio + delta), fim: Math.max(0.5, t.fim + delta) } : t
              );
            } else if (faixa === "legenda") {
              p.legendas = p.legendas.map((l) => (l.id === idClip ? { ...l, inicio: Math.max(0, l.inicio + delta), fim: Math.max(0.3, l.fim + delta) } : l));
            } else {
              p.layoutClips = (p.layoutClips ?? []).map((c) =>
                c.id === idClip ? { ...c, inicio: Math.max(0, c.inicio + delta), fim: Math.max(0.5, c.fim + delta) } : c
              );
            }
            return p;
          })
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------- pedaços

const campo = "w-full rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-gold-400";

function Secao({ titulo, resumo, children }: { titulo: string; resumo?: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(true);
  return (
    <section className="rounded-xl border border-ink-200 bg-white/70">
      <button onClick={() => setAberto((a) => !a)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="text-sm font-semibold text-ink-900">{titulo}</span>
        <span className="flex items-center gap-2 text-[11px] text-ink-400">
          {resumo}
          <span className="text-ink-300">{aberto ? "▲" : "▼"}</span>
        </span>
      </button>
      {aberto && <div className="border-t border-ink-100 p-3">{children}</div>}
    </section>
  );
}

function PainelMetadinha({
  projeto,
  flowId,
  mexer,
  sel,
  onSel,
  onUsarFluxo,
  onGerar,
  ocupado,
  onIr,
}: {
  projeto: VideoProject;
  flowId: string | null;
  mexer: (fn: (p: VideoProject) => VideoProject) => void;
  sel: Selecao;
  onSel: (s: Selecao) => void;
  onUsarFluxo: (id: string) => void;
  onGerar: (videoId: string) => void;
  ocupado: boolean;
  onIr: (t: number) => void;
}) {
  const [fluxos, setFluxos] = useState<StudioFlowRow[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [escolhido, setEscolhido] = useState("");
  const [videoEscolhido, setVideoEscolhido] = useState("");

  useEffect(() => {
    fetch("/api/studio-flows?limit=100")
      .then((r) => r.json())
      .then((d) => {
        setFluxos(d.flows ?? []);
        setEscolhido(flowId ?? d.flows?.[0]?.id ?? "");
      });
    fetch("/api/videos?scope=own")
      .then((r) => r.json())
      .then((d) => setVideos((d.videos ?? []).filter((v: VideoRow) => v.latest_analysis_status === "done")));
  }, [flowId]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-ink-600">Usar uma metadinha que já existe</div>
          <div className="flex gap-1">
            <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)} className={campo}>
              {fluxos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} ({Array.isArray(f.scenes) ? (f.scenes as unknown[]).length : 0} telas)
                </option>
              ))}
            </select>
            <button
              onClick={() => escolhido && onUsarFluxo(escolhido)}
              disabled={ocupado || !escolhido}
              className="shrink-0 rounded-lg border border-gold-300 bg-white px-2 py-1 text-[11px] font-semibold text-gold-700 hover:bg-gold-50 disabled:opacity-50"
            >
              Usar
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-medium text-ink-600">Gerar uma metadinha nova (a partir de um vídeo analisado)</div>
          <div className="flex gap-1">
            <select value={videoEscolhido} onChange={(e) => setVideoEscolhido(e.target.value)} className={campo}>
              <option value="">escolha o vídeo de referência...</option>
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {(v.caption ?? "sem legenda").split("\n")[0].slice(0, 50)}
                </option>
              ))}
            </select>
            <button
              onClick={() => videoEscolhido && onGerar(videoEscolhido)}
              disabled={ocupado || !videoEscolhido}
              className="btn-gold shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
            >
              ✦ Gerar
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            mexer((p) => {
              const dur = p.fonte?.duracao ?? 60;
              const fatia = dur / Math.max(1, p.telas.length);
              return { ...p, telas: p.telas.map((t, i) => ({ ...t, inicio: Number((i * fatia).toFixed(2)), fim: Number(((i + 1) * fatia).toFixed(2)) })) };
            })
          }
          disabled={!projeto.telas.length}
          className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 disabled:opacity-40"
        >
          Distribuir no vídeo todo
        </button>
        <button
          onClick={() => mexer((p) => ({ ...p, telas: [] }))}
          disabled={!projeto.telas.length}
          className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 disabled:opacity-40"
        >
          Limpar telas
        </button>
      </div>

      <div className="max-h-48 space-y-1 overflow-y-auto">
        {projeto.telas.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${sel?.faixa === "tela" && sel.id === t.id ? "border-gold-400 bg-gold-50" : "border-ink-100"}`}
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
        {!projeto.telas.length && <p className="text-xs text-ink-400">Sem telas. Use uma metadinha pronta acima ou gere uma nova.</p>}
      </div>
    </div>
  );
}

function PainelLayout({
  projeto,
  mexer,
  tempo,
  onTrocarVideo,
  sel,
  onSel,
}: {
  projeto: VideoProject;
  mexer: (fn: (p: VideoProject) => VideoProject) => void;
  tempo: number;
  onTrocarVideo: (f: File | undefined) => void;
  sel: Selecao;
  onSel: (s: Selecao) => void;
}) {
  const enq = projeto.layout.enquadramento ?? { zoom: 1, dx: 0, dy: 0 };
  const clips = projeto.layoutClips ?? [];

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {LAYOUTS.map((l) => (
          <button
            key={l.id}
            onClick={() => mexer((p) => ({ ...p, layout: { ...p.layout, modo: l.id } }))}
            className={`rounded-xl border p-2 text-left ${projeto.layout.modo === l.id ? "border-gold-400 bg-gold-50" : "border-ink-200 bg-white hover:border-gold-300"}`}
          >
            <Miniatura modo={l.id} divisao={projeto.layout.divisao} />
            <div className="mt-1 text-[11px] font-semibold text-ink-800">{l.nome}</div>
            <div className="text-[10px] leading-tight text-ink-400">{l.dica}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <label className="text-[11px] text-ink-500">
          Divisão ({Math.round(projeto.layout.divisao * 100)}% vídeo)
          <input type="range" min={0.2} max={0.8} step={0.01} value={projeto.layout.divisao} className="w-full accent-gold-600" onChange={(e) => mexer((p) => ({ ...p, layout: { ...p.layout, divisao: Number(e.target.value) } }))} />
        </label>
        <label className="text-[11px] text-ink-500">
          Zoom do vídeo ({enq.zoom.toFixed(2)}x)
          <input type="range" min={1} max={2.5} step={0.01} value={enq.zoom} className="w-full accent-gold-600" onChange={(e) => mexer((p) => ({ ...p, layout: { ...p.layout, enquadramento: { ...enq, zoom: Number(e.target.value) } } }))} />
        </label>
        <label className="text-[11px] text-ink-500">
          Subir/descer a imagem
          <input type="range" min={-0.5} max={0.5} step={0.01} value={enq.dy} className="w-full accent-gold-600" onChange={(e) => mexer((p) => ({ ...p, layout: { ...p.layout, enquadramento: { ...enq, dy: Number(e.target.value) } } }))} />
        </label>
        <label className="text-[11px] text-ink-500">
          Fundo
          <input type="color" value={projeto.layout.fundo} className="h-7 w-full rounded-lg border border-ink-200" onChange={(e) => mexer((p) => ({ ...p, layout: { ...p.layout, fundo: e.target.value } }))} />
        </label>
      </div>

      <div className="rounded-lg bg-ink-50 p-2">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-ink-600">Trocar o layout só num trecho</span>
          <button
            onClick={() =>
              mexer((p) => {
                const inicio = paraFonte(p, tempo);
                const fim = Math.min((p.fonte?.duracao ?? inicio + 5), inicio + 5);
                return { ...p, layoutClips: [...(p.layoutClips ?? []), { id: novoId(), inicio, fim, modo: "cheio" as LayoutModo }] };
              })
            }
            className="rounded-lg border border-sky-300 bg-white px-2 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-50"
          >
            + Trecho a partir da agulha
          </button>
        </div>
        <div className="space-y-1">
          {clips.map((c) => (
            <div
              key={c.id}
              className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1 ${sel?.faixa === "layout" && sel.id === c.id ? "border-sky-400 bg-sky-50" : "border-ink-100 bg-white"}`}
              onClick={() => onSel({ faixa: "layout", id: c.id })}
            >
              <input type="number" step="0.5" value={c.inicio} className="w-16 rounded border border-ink-200 px-1 py-0.5 text-[11px]" onChange={(e) => mexer((p) => ({ ...p, layoutClips: (p.layoutClips ?? []).map((x) => (x.id === c.id ? { ...x, inicio: Number(e.target.value) } : x)) }))} />
              <input type="number" step="0.5" value={c.fim} className="w-16 rounded border border-ink-200 px-1 py-0.5 text-[11px]" onChange={(e) => mexer((p) => ({ ...p, layoutClips: (p.layoutClips ?? []).map((x) => (x.id === c.id ? { ...x, fim: Number(e.target.value) } : x)) }))} />
              <select value={c.modo} className="rounded border border-ink-200 px-1 py-0.5 text-[11px]" onChange={(e) => mexer((p) => ({ ...p, layoutClips: (p.layoutClips ?? []).map((x) => (x.id === c.id ? { ...x, modo: e.target.value as LayoutModo } : x)) }))}>
                {LAYOUTS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  mexer((p) => ({ ...p, layoutClips: (p.layoutClips ?? []).filter((x) => x.id !== c.id) }));
                }}
                className="ml-auto text-xs text-ink-400 hover:text-rose-600"
              >
                ✕
              </button>
            </div>
          ))}
          {!clips.length && <p className="text-[11px] text-ink-400">Nenhum trecho com layout diferente — o layout escolhido acima vale no vídeo todo.</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50">
          Trocar o vídeo do Augusto
          <input type="file" accept="video/*" className="hidden" onChange={(e) => onTrocarVideo(e.target.files?.[0])} />
        </label>
        <span className="text-[11px] text-ink-400">{projeto.fonte?.nome ? `${projeto.fonte.nome} · ${mmss(projeto.fonte.duracao)}` : "nenhum vídeo enviado"}</span>
      </div>
    </div>
  );
}

/** Desenho simples do formato do quadro, para escolher no olho. */
function Miniatura({ modo, divisao }: { modo: LayoutModo; divisao: number }) {
  const video = "bg-ink-800";
  const tela = "bg-gold-300";
  const alturaVideo = `${Math.round(divisao * 100)}%`;
  return (
    <div className="relative mx-auto h-16 w-9 overflow-hidden rounded border border-ink-200 bg-ink-100">
      {modo === "metadinha" && (
        <>
          <div className={`absolute inset-x-0 top-0 ${video}`} style={{ height: alturaVideo }} />
          <div className={`absolute inset-x-0 bottom-0 ${tela}`} style={{ height: `${100 - divisao * 100}%` }} />
        </>
      )}
      {modo === "metadinha-topo" && (
        <>
          <div className={`absolute inset-x-0 top-0 ${tela}`} style={{ height: `${100 - divisao * 100}%` }} />
          <div className={`absolute inset-x-0 bottom-0 ${video}`} style={{ height: alturaVideo }} />
        </>
      )}
      {modo === "cheio" && (
        <>
          <div className={`absolute inset-0 ${video}`} />
          <div className={`absolute inset-x-1 bottom-1 h-6 rounded ${tela}`} />
        </>
      )}
      {modo === "tela" && <div className={`absolute inset-0 ${tela}`} />}
    </div>
  );
}

function PainelCortes({
  projeto,
  mexer,
  onDetectar,
  ocupado,
  tempo,
  marcaA,
  onMarcar,
  onCortar,
  onLimparMarca,
}: {
  projeto: VideoProject;
  mexer: (fn: (p: VideoProject) => VideoProject) => void;
  onDetectar: (o: { limiar: number; minimo: number; folga: number; protegerInicio: number }) => void;
  ocupado: boolean;
  tempo: number;
  marcaA: number | null;
  onMarcar: () => void;
  onCortar: () => void;
  onLimparMarca: () => void;
}) {
  const [limiar, setLimiar] = useState(-45);
  const [minimo, setMinimo] = useState(0.35);
  const [folga, setFolga] = useState(0.08);
  const [protegerInicio, setProteger] = useState(0);

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-ink-50 p-2">
        <div className="mb-1 text-[11px] font-medium text-ink-600">Cortar na mão</div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onMarcar} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50">
            Marcar início aqui ({mmss(tempo)})
          </button>
          <button onClick={onCortar} disabled={marcaA == null} className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40">
            ✂ Cortar daqui até a agulha
          </button>
          {marcaA != null && (
            <span className="text-[11px] text-ink-500">
              início marcado em {mmss(marcaA)}{" "}
              <button onClick={onLimparMarca} className="text-ink-400 underline">
                limpar
              </button>
            </span>
          )}
        </div>
      </div>

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
        <button onClick={() => onDetectar({ limiar, minimo, folga, protegerInicio })} disabled={ocupado || !projeto.fonte?.url} className="btn-gold rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
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
            <span className="text-[10px] text-ink-400">
              {(c.fim - c.inicio).toFixed(2)}s · {c.motivo ?? "manual"}
            </span>
            <button onClick={() => mexer((p) => ({ ...p, cortes: p.cortes.filter((_, k) => k !== i) }))} className="ml-auto text-ink-400 hover:text-rose-600">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PainelTextos({
  projeto,
  mexer,
  tempo,
  sel,
  onSel,
  onIr,
}: {
  projeto: VideoProject;
  mexer: (fn: (p: VideoProject) => VideoProject) => void;
  tempo: number;
  sel: Selecao;
  onSel: (s: Selecao) => void;
  onIr: (t: number) => void;
}) {
  const textos = projeto.textos ?? [];
  const trocar = (id: string, campos: Partial<TextoClip>) =>
    mexer((p) => ({ ...p, textos: (p.textos ?? []).map((t) => (t.id === id ? { ...t, ...campos } : t)) }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() =>
            mexer((p) => {
              const inicio = paraFonte(p, tempo);
              const fim = Math.min(p.fonte?.duracao ?? inicio + 3, inicio + 3);
              const novo = textoPadrao(inicio, Math.max(inicio + 1, fim));
              onSel({ faixa: "texto", id: novo.id });
              return { ...p, textos: [...(p.textos ?? []), novo] };
            })
          }
          className="btn-gold rounded-lg px-3 py-1.5 text-xs font-semibold"
        >
          + Texto na agulha ({mmss(tempo)})
        </button>
        <span className="text-[11px] text-ink-400">a chamada do vídeo, uma frase de efeito, um aviso</span>
      </div>

      <div className="space-y-2">
        {textos.map((t) => {
          const aberto = sel?.faixa === "texto" && sel.id === t.id;
          return (
            <div
              key={t.id}
              className={`rounded-xl border p-2 ${aberto ? "border-amber-400 bg-amber-50/60" : "border-ink-100 bg-white"}`}
            >
              <div
                className="flex cursor-pointer items-center gap-2"
                onClick={() => {
                  onSel(aberto ? null : { faixa: "texto", id: t.id });
                  const tl = paraLinha(projeto, t.inicio);
                  if (tl != null) onIr(tl);
                }}
              >
                <span className="w-20 shrink-0 font-mono text-[10px] text-ink-400">
                  {mmss(t.inicio)}–{mmss(t.fim)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-ink-700" style={{ fontFamily: FONTES.find((f) => f.id === t.fonte)?.css }}>
                  {t.texto || "(vazio)"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    mexer((p) => ({ ...p, textos: (p.textos ?? []).filter((x) => x.id !== t.id) }));
                  }}
                  className="text-xs text-ink-400 hover:text-rose-600"
                >
                  ✕
                </button>
              </div>

              {aberto && (
                <div className="mt-2 space-y-2 border-t border-ink-100 pt-2">
                  <textarea
                    value={t.texto}
                    rows={2}
                    onChange={(e) => trocar(t.id, { texto: e.target.value })}
                    className="w-full rounded-lg border border-ink-200 px-2 py-1 text-sm"
                    style={{ fontFamily: FONTES.find((f) => f.id === t.fonte)?.css }}
                    placeholder="Escreva o texto (Enter quebra a linha)"
                  />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="text-[11px] text-ink-500">
                      Fonte
                      <select value={t.fonte} className={campo} onChange={(e) => trocar(t.id, { fonte: e.target.value })}>
                        {FONTES.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] text-ink-500">
                      Tamanho ({t.tamanho})
                      <input type="range" min={24} max={180} step={2} value={t.tamanho} className="w-full accent-gold-600" onChange={(e) => trocar(t.id, { tamanho: Number(e.target.value) })} />
                    </label>
                    <label className="text-[11px] text-ink-500">
                      Cor
                      <input type="color" value={t.cor} className="h-7 w-full rounded-lg border border-ink-200" onChange={(e) => trocar(t.id, { cor: e.target.value })} />
                    </label>
                    <label className="text-[11px] text-ink-500">
                      Alinhamento
                      <select value={t.alinhamento} className={campo} onChange={(e) => trocar(t.id, { alinhamento: e.target.value as TextoClip["alinhamento"] })}>
                        <option value="center">centro</option>
                        <option value="left">esquerda</option>
                        <option value="right">direita</option>
                      </select>
                    </label>
                    <label className="text-[11px] text-ink-500">
                      Posição ↔ ({Math.round(t.x * 100)}%)
                      <input type="range" min={0.05} max={0.95} step={0.01} value={t.x} className="w-full accent-gold-600" onChange={(e) => trocar(t.id, { x: Number(e.target.value) })} />
                    </label>
                    <label className="text-[11px] text-ink-500">
                      Posição ↕ ({Math.round(t.y * 100)}%)
                      <input type="range" min={0.03} max={0.97} step={0.01} value={t.y} className="w-full accent-gold-600" onChange={(e) => trocar(t.id, { y: Number(e.target.value) })} />
                    </label>
                    <label className="text-[11px] text-ink-500">
                      Largura ({Math.round(t.largura * 100)}%)
                      <input type="range" min={0.3} max={0.95} step={0.01} value={t.largura} className="w-full accent-gold-600" onChange={(e) => trocar(t.id, { largura: Number(e.target.value) })} />
                    </label>
                    <div className="flex flex-wrap items-end gap-2 text-[11px] text-ink-500">
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={t.negrito} className="accent-gold-600" onChange={(e) => trocar(t.id, { negrito: e.target.checked })} />
                        negrito
                      </label>
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={t.italico} className="accent-gold-600" onChange={(e) => trocar(t.id, { italico: e.target.checked })} />
                        itálico
                      </label>
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={t.contorno} className="accent-gold-600" onChange={(e) => trocar(t.id, { contorno: e.target.checked })} />
                        contorno
                      </label>
                    </div>
                    <label className="text-[11px] text-ink-500">
                      Entra em (s)
                      <input type="number" step="0.5" value={t.inicio} className={campo} onChange={(e) => trocar(t.id, { inicio: Number(e.target.value) })} />
                    </label>
                    <label className="text-[11px] text-ink-500">
                      Sai em (s)
                      <input type="number" step="0.5" value={t.fim} className={campo} onChange={(e) => trocar(t.id, { fim: Number(e.target.value) })} />
                    </label>
                    <label className="text-[11px] text-ink-500">
                      Caixa atrás
                      <select value={t.fundo} className={campo} onChange={(e) => trocar(t.id, { fundo: e.target.value })}>
                        <option value="transparent">sem caixa</option>
                        <option value="rgba(0,0,0,0.55)">preta translúcida</option>
                        <option value="#1F1F1B">preta sólida</option>
                        <option value="#FFFFFF">branca</option>
                        <option value="#E08C3A">laranja</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!textos.length && <p className="text-xs text-ink-400">Nenhum texto ainda.</p>}
      </div>
    </div>
  );
}

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
  sel: Selecao;
  onSel: (s: Selecao) => void;
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
        <button onClick={() => mexer((p) => ({ ...p, legendas: [] }))} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">
          Limpar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-[11px] text-ink-500">
          Fonte
          <select value={e.fonte ?? "augusto"} className={campo} onChange={(ev) => mexer((p) => ({ ...p, legendaEstilo: { ...p.legendaEstilo, fonte: ev.target.value } }))}>
            {FONTES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>
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
        <label className="text-[11px] text-ink-500">
          Margem ({Math.round(e.margem * 100)}%)
          <input type="range" min={0.02} max={0.35} step={0.01} value={e.margem} className="w-full accent-gold-600" onChange={(ev) => mexer((p) => ({ ...p, legendaEstilo: { ...p.legendaEstilo, margem: Number(ev.target.value) } }))} />
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
            className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${sel?.faixa === "legenda" && sel.id === l.id ? "border-emerald-400 bg-emerald-50" : "border-ink-100"}`}
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
              <input type="range" min={0} max={1} step={0.01} value={m.volume} className="w-full accent-gold-600" onChange={(e) => mexer((p) => ({ ...p, musica: p.musica ? { ...p.musica, volume: Number(e.target.value) } : p.musica }))} />
            </label>
            <label className="text-[11px] text-ink-500">
              Começar a música em (s)
              <input type="number" step="0.5" value={m.inicioNaMusica} className={campo} onChange={(e) => mexer((p) => ({ ...p, musica: p.musica ? { ...p.musica, inicioNaMusica: Number(e.target.value) } : p.musica }))} />
            </label>
            <label className="text-[11px] text-ink-500">
              Fade no fim (s)
              <input type="number" step="0.5" value={m.fadeOut} className={campo} onChange={(e) => mexer((p) => ({ ...p, musica: p.musica ? { ...p.musica, fadeOut: Number(e.target.value) } : p.musica }))} />
            </label>
          </div>
          <button onClick={() => mexer((p) => ({ ...p, musica: null }))} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">
            Tirar música
          </button>
        </>
      )}
      <label className="block text-[11px] text-ink-500">
        Volume da fala ({Math.round((projeto.volumeFonte ?? 1) * 100)}%)
        <input type="range" min={0} max={1.5} step={0.05} value={projeto.volumeFonte} className="w-full accent-gold-600" onChange={(e) => mexer((p) => ({ ...p, volumeFonte: Number(e.target.value) }))} />
      </label>
    </div>
  );
}

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
