/**
 * O MOTOR: toca o projeto e grava o arquivo final.
 *
 * A mesma peça serve para a prévia e para a exportação — a diferença é só o
 * gravador ligado. Ele cuida de três coisas:
 *  1. pular os trechos cortados (o vídeo é buscado para o próximo pedaço);
 *  2. desenhar cada quadro no canvas com o pintor;
 *  3. juntar o áudio do vídeo com a música num destino só.
 *
 * A exportação é em tempo real (grava enquanto toca). Quando quisermos algo
 * mais rápido e com corte sem emenda, o lugar de trocar é o método exportar():
 * a montagem do quadro continua a mesma.
 */
import { pintarQuadro } from "@/lib/video/painter";
import { duracaoFinal, paraFonte, segmentoEm, segmentos, type VideoProject } from "@/lib/video/types";

export interface MotorOpcoes {
  onTempo?: (tl: number) => void;
  onFim?: () => void;
  onErro?: (e: Error) => void;
}

/** URL que o navegador pode ler sem esbarrar em CORS (mesma origem). */
export function urlDeMidia(url: string | null | undefined) {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  return `/api/media-proxy?url=${encodeURIComponent(url)}`;
}

export class MotorVideo {
  projeto: VideoProject;
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  private ctx: CanvasRenderingContext2D;
  private opcoes: MotorOpcoes;
  private raf: number | null = null;
  private tocando = false;
  private tl = 0;
  private ultimoTs = 0;
  private buscando = false;

  // áudio
  private audioCtx: AudioContext | null = null;
  private fonteNode: MediaElementAudioSourceNode | null = null;
  private ganhoFonte: GainNode | null = null;
  private musicaBuffer: AudioBuffer | null = null;
  private musicaNode: AudioBufferSourceNode | null = null;
  private ganhoMusica: GainNode | null = null;
  private destinoGravacao: MediaStreamAudioDestinationNode | null = null;

  constructor(canvas: HTMLCanvasElement, projeto: VideoProject, opcoes: MotorOpcoes = {}) {
    this.canvas = canvas;
    this.projeto = projeto;
    this.opcoes = opcoes;
    canvas.width = projeto.largura;
    canvas.height = projeto.altura;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas sem contexto 2D.");
    this.ctx = ctx;

    this.video = document.createElement("video");
    this.video.crossOrigin = "anonymous";
    this.video.playsInline = true;
    this.video.preload = "auto";
    // o elemento fica na página (escondido): fora do documento o navegador
    // segura a decodificação e o canvas recebe quadros parados
    this.video.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
    document.body.appendChild(this.video);
    if (projeto.fonte?.url) this.video.src = urlDeMidia(projeto.fonte.url);
  }

  get duracao() {
    return duracaoFinal(this.projeto);
  }

  get tempo() {
    return this.tl;
  }

  atualizarProjeto(projeto: VideoProject) {
    const trocouFonte = projeto.fonte?.url !== this.projeto.fonte?.url;
    this.projeto = projeto;
    this.canvas.width = projeto.largura;
    this.canvas.height = projeto.altura;
    if (trocouFonte && projeto.fonte?.url) this.video.src = urlDeMidia(projeto.fonte.url);
    if (this.ganhoFonte) this.ganhoFonte.gain.value = projeto.volumeFonte ?? 1;
    if (this.ganhoMusica) this.ganhoMusica.gain.value = projeto.musica?.volume ?? 0.25;
    this.desenhar();
  }

  /** Desenha o quadro do instante atual (sem tocar). */
  desenhar() {
    pintarQuadro(this.ctx, {
      projeto: this.projeto,
      tempoFonte: paraFonte(this.projeto, this.tl),
      video: this.video,
    });
  }

  async irPara(tl: number) {
    this.tl = Math.max(0, Math.min(this.duracao, tl));
    const alvo = paraFonte(this.projeto, this.tl);
    await this.buscar(alvo);
    this.desenhar();
    this.opcoes.onTempo?.(this.tl);
  }

  private buscar(tempoFonte: number) {
    return new Promise<void>((resolve) => {
      if (!this.video.src) return resolve();
      if (Math.abs(this.video.currentTime - tempoFonte) < 0.05) return resolve();
      this.buscando = true;
      const pronto = () => {
        this.video.removeEventListener("seeked", pronto);
        this.buscando = false;
        resolve();
      };
      this.video.addEventListener("seeked", pronto);
      try {
        this.video.currentTime = tempoFonte;
      } catch {
        pronto();
      }
    });
  }

  private async prepararAudio(paraGravar: boolean) {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.fonteNode = this.audioCtx.createMediaElementSource(this.video);
      this.ganhoFonte = this.audioCtx.createGain();
      this.ganhoFonte.gain.value = this.projeto.volumeFonte ?? 1;
      this.fonteNode.connect(this.ganhoFonte);
      this.ganhoFonte.connect(this.audioCtx.destination);

      this.ganhoMusica = this.audioCtx.createGain();
      this.ganhoMusica.gain.value = this.projeto.musica?.volume ?? 0.25;
      this.ganhoMusica.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === "suspended") await this.audioCtx.resume();

    if (paraGravar && !this.destinoGravacao) {
      this.destinoGravacao = this.audioCtx.createMediaStreamDestination();
      this.ganhoFonte?.connect(this.destinoGravacao);
      this.ganhoMusica?.connect(this.destinoGravacao);
    }
  }

  /** Carrega a música (uma vez) para tocar junto. */
  async carregarMusica() {
    const m = this.projeto.musica;
    if (!m?.url) {
      this.musicaBuffer = null;
      return;
    }
    await this.prepararAudio(false);
    const res = await fetch(urlDeMidia(m.url));
    const bytes = await res.arrayBuffer();
    this.musicaBuffer = await this.audioCtx!.decodeAudioData(bytes);
  }

  private tocarMusica(desdeTl: number) {
    if (!this.musicaBuffer || !this.audioCtx || !this.ganhoMusica) return;
    this.pararMusica();
    const m = this.projeto.musica!;
    const node = this.audioCtx.createBufferSource();
    node.buffer = this.musicaBuffer;
    node.loop = true;
    node.connect(this.ganhoMusica);
    const offset = (m.inicioNaMusica ?? 0) + desdeTl;
    node.start(0, offset % this.musicaBuffer.duration);
    this.musicaNode = node;

    // fade out no fim do vídeo
    const restante = this.duracao - desdeTl;
    const fade = Math.max(0, m.fadeOut ?? 0);
    const agora = this.audioCtx.currentTime;
    this.ganhoMusica.gain.cancelScheduledValues(agora);
    this.ganhoMusica.gain.setValueAtTime(m.volume ?? 0.25, agora);
    if (fade > 0 && restante > fade) {
      this.ganhoMusica.gain.setValueAtTime(m.volume ?? 0.25, agora + restante - fade);
      this.ganhoMusica.gain.linearRampToValueAtTime(0.0001, agora + restante);
    }
  }

  private pararMusica() {
    try {
      this.musicaNode?.stop();
    } catch {
      // já parada
    }
    this.musicaNode = null;
  }

  async tocar() {
    if (this.tocando) return;
    await this.prepararAudio(false);
    if (this.tl >= this.duracao - 0.05) await this.irPara(0);
    this.tocando = true;
    this.ultimoTs = performance.now();
    this.tocarMusica(this.tl);
    await this.video.play().catch(() => undefined);
    this.laco();
  }

  pausar() {
    this.tocando = false;
    this.video.pause();
    this.pararMusica();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  private laco = () => {
    if (!this.tocando) return;
    const agora = performance.now();
    const dt = Math.min(0.25, (agora - this.ultimoTs) / 1000);
    this.ultimoTs = agora;

    if (!this.buscando) {
      this.tl = Math.min(this.duracao, this.tl + dt);
      const seg = segmentoEm(this.projeto, this.tl);
      const fonteAlvo = paraFonte(this.projeto, this.tl);
      // passou do fim do pedaço: pula o corte
      if (seg && this.video.currentTime > seg.fonteFim + 0.05) {
        this.buscar(fonteAlvo);
      } else if (Math.abs(this.video.currentTime - fonteAlvo) > 0.4) {
        // dessincronizou (buffer, corte manual): reancora no tempo certo
        this.buscar(fonteAlvo);
      }
    }

    this.desenhar();
    this.opcoes.onTempo?.(this.tl);

    if (this.tl >= this.duracao - 0.01) {
      this.pausar();
      this.opcoes.onFim?.();
      return;
    }
    this.raf = requestAnimationFrame(this.laco);
  };

  /**
   * Grava o vídeo final tocando o projeto do começo ao fim.
   * Devolve o arquivo (mp4 quando o navegador aceita, senão webm).
   */
  async exportar(onProgresso?: (p: number) => void): Promise<{ blob: Blob; extensao: string }> {
    if (!this.projeto.fonte?.url) throw new Error("Envie o vídeo do Augusto antes de exportar.");
    if (!this.duracao) throw new Error("O projeto está sem duração.");

    await this.prepararAudio(true);
    await this.carregarMusica().catch(() => undefined);

    const tipos = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mime = tipos.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
    if (!mime) throw new Error("Este navegador não grava vídeo (MediaRecorder indisponível). Use o Chrome.");

    const fluxo = this.canvas.captureStream(this.projeto.fps || 30);
    for (const faixa of this.destinoGravacao?.stream.getAudioTracks() ?? []) fluxo.addTrack(faixa);

    const gravador = new MediaRecorder(fluxo, {
      mimeType: mime,
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 192_000,
    });
    const pedacos: BlobPart[] = [];
    gravador.ondataavailable = (e) => e.data.size && pedacos.push(e.data);

    const fim = new Promise<void>((resolve) => {
      gravador.onstop = () => resolve();
    });

    await this.irPara(0);
    gravador.start(1000);
    const avisar = setInterval(() => onProgresso?.(Math.min(0.99, this.tl / this.duracao)), 250);

    await new Promise<void>((resolve) => {
      const antigo = this.opcoes.onFim;
      this.opcoes.onFim = () => {
        this.opcoes.onFim = antigo;
        antigo?.();
        resolve();
      };
      this.tocar();
    });

    clearInterval(avisar);
    gravador.stop();
    await fim;
    onProgresso?.(1);

    const extensao = mime.startsWith("video/mp4") ? "mp4" : "webm";
    return { blob: new Blob(pedacos, { type: mime }), extensao };
  }

  destruir() {
    this.pausar();
    try {
      this.audioCtx?.close();
    } catch {
      // já fechado
    }
    this.video.src = "";
    this.video.remove();
  }
}

/** Quantos segundos de vídeo e quantos pedaços o projeto tem. */
export function resumoProjeto(projeto: VideoProject) {
  const partes = segmentos(projeto);
  return {
    duracao: duracaoFinal(projeto),
    pedacos: partes.length,
    cortado: (projeto.fonte?.duracao ?? 0) - duracaoFinal(projeto),
  };
}
