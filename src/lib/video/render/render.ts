/**
 * RENDERIZAÇÃO NO SERVIDOR (roda na Vercel).
 *
 * Monta o arquivo final sem navegador nenhum:
 *  1. baixa o vídeo bruto (e a música) para /tmp;
 *  2. desenha as camadas com o mesmo pintor da prévia (overlays.ts);
 *  3. manda um ffmpeg só fazer tudo: cortar os trechos, encaixar o vídeo no
 *     layout, sobrepor as camadas, misturar a música e codificar em H.264.
 *
 * É mais rápido que tempo real e o corte sai sem emenda — diferente da
 * exportação do navegador, que grava tocando.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { montarCamadas, areaDoVideo, type Camada } from "@/lib/video/render/overlays";
import { duracaoFinal, layoutEm, segmentos, type VideoProject } from "@/lib/video/types";

export class RenderError extends Error {}

export interface RenderOpcoes {
  onProgresso?: (fracao: number, etapa: string) => void;
  /** qualidade do H.264: menor = melhor (18 a 28) */
  crf?: number;
  /** velocidade do codificador */
  preset?: "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" | "medium";
}

function caminhoFfmpeg(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpeg = require("ffmpeg-static") as string | null;
  if (!ffmpeg) throw new RenderError("ffmpeg não encontrado no servidor (pacote ffmpeg-static).");
  return ffmpeg;
}

async function baixar(url: string, destino: string) {
  const res = await fetch(url);
  if (!res.ok) throw new RenderError(`Não consegui baixar ${url} (status ${res.status}).`);
  const bytes = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destino, bytes);
  return destino;
}

function escaparCaminho(p: string) {
  return p.replace(/\\/g, "/");
}

/**
 * O grafo de filtros: cortes, layout, camadas e música.
 * Os tempos das camadas já estão na linha do tempo final.
 */
export function montarFiltros(p: VideoProject, camadas: Camada[], temMusica: boolean) {
  const L = p.largura;
  const A = p.altura;
  const partes = segmentos(p);
  const dur = duracaoFinal(p);
  const modo = layoutEm(p, 0).modo;
  const area = areaDoVideo(p);
  const linhas: string[] = [];

  // 1. corta os trechos do vídeo e do áudio e cola tudo de volta
  partes.forEach((s, i) => {
    linhas.push(`[0:v]trim=start=${s.fonteInicio.toFixed(3)}:end=${s.fonteFim.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
    linhas.push(`[0:a]atrim=start=${s.fonteInicio.toFixed(3)}:end=${s.fonteFim.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`);
  });
  const entradas = partes.map((_, i) => `[v${i}][a${i}]`).join("");
  linhas.push(`${entradas}concat=n=${partes.length}:v=1:a=1[vcortado][acortado]`);

  // 2. encaixa o vídeo no layout (recorta cobrindo a área, como no editor)
  const enq = p.layout.enquadramento ?? { zoom: 1, dx: 0, dy: 0 };
  if (modo === "tela" || !area) {
    linhas.push(`color=c=${p.layout.fundo || "#2E2E2E"}:s=${L}x${A}:d=${dur.toFixed(3)}[base]`);
  } else {
    const zoom = Math.max(1, enq.zoom || 1);
    const larguraEscalada = Math.round((area.w * zoom) / 2) * 2;
    const alturaEscalada = Math.round((area.h * zoom) / 2) * 2;
    const desX = Math.round((enq.dx || 0) * area.w);
    const desY = Math.round((enq.dy || 0) * area.h);
    linhas.push(
      `[vcortado]scale=${larguraEscalada}:${alturaEscalada}:force_original_aspect_ratio=increase,` +
        `crop=${area.w}:${area.h}:(iw-ow)/2-${desX}:(ih-oh)/2-${desY},setsar=1[vlayout]`
    );
    linhas.push(`color=c=${p.layout.fundo || "#2E2E2E"}:s=${L}x${A}:d=${dur.toFixed(3)}[fundo]`);
    linhas.push(`[fundo][vlayout]overlay=${area.x}:${area.y}:shortest=1[base]`);
  }

  // 3. sobrepõe as camadas (telas do estúdio, textos e legendas)
  let atual = "base";
  camadas.forEach((c, i) => {
    const entrada = temMusica ? i + 2 : i + 1; // 0 = vídeo, 1 = música quando existe
    const saida = `ov${i}`;
    linhas.push(
      `[${atual}][${entrada}:v]overlay=${c.x}:${c.y}:enable='between(t,${c.inicio.toFixed(3)},${c.fim.toFixed(3)})'[${saida}]`
    );
    atual = saida;
  });
  linhas.push(`[${atual}]format=yuv420p[vout]`);

  // 4. áudio: fala + música com fade no fim
  const volumeFala = p.volumeFonte ?? 1;
  if (temMusica && p.musica) {
    const m = p.musica;
    const fade = Math.max(0, m.fadeOut ?? 0);
    const inicioMusica = Math.max(0, m.inicioNaMusica ?? 0);
    linhas.push(
      `[1:a]atrim=start=${inicioMusica.toFixed(3)},asetpts=PTS-STARTPTS,` +
        `aloop=loop=-1:size=2e9,atrim=duration=${dur.toFixed(3)},` +
        `volume=${(m.volume ?? 0.25).toFixed(3)}` +
        (fade > 0 ? `,afade=t=out:st=${Math.max(0, dur - fade).toFixed(3)}:d=${fade.toFixed(3)}` : "") +
        `[amusica]`
    );
    linhas.push(`[acortado]volume=${volumeFala.toFixed(3)}[afala]`);
    linhas.push(`[afala][amusica]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[aout]`);
  } else {
    linhas.push(`[acortado]volume=${volumeFala.toFixed(3)}[aout]`);
  }

  return linhas.join(";\n");
}

export interface ResultadoRender {
  arquivo: string;
  bytes: number;
  duracao: number;
  segundos: number;
}

export async function renderizarProjeto(p: VideoProject, opts: RenderOpcoes = {}): Promise<ResultadoRender> {
  const comecou = Date.now();
  if (!p.fonte?.url) throw new RenderError("O projeto está sem o vídeo do Augusto.");
  const dur = duracaoFinal(p);
  if (!dur) throw new RenderError("O projeto está sem duração (o vídeo não carregou?).");

  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "videoteca-"));
  try {
    opts.onProgresso?.(0.05, "baixando o vídeo");
    const entradaVideo = await baixar(p.fonte.url, path.join(pasta, "bruto.mp4"));

    let entradaMusica: string | null = null;
    if (p.musica?.url) {
      opts.onProgresso?.(0.12, "baixando a música");
      entradaMusica = await baixar(p.musica.url, path.join(pasta, "musica.mp3"));
    }

    opts.onProgresso?.(0.18, "desenhando as telas, textos e legendas");
    const camadas = montarCamadas(p);
    const arquivosCamadas: string[] = [];
    for (let i = 0; i < camadas.length; i++) {
      const arq = path.join(pasta, `camada-${String(i).padStart(3, "0")}.png`);
      await fs.writeFile(arq, camadas[i].png);
      arquivosCamadas.push(arq);
    }

    const filtros = montarFiltros(p, camadas, Boolean(entradaMusica));
    const arquivoFiltros = path.join(pasta, "filtros.txt");
    await fs.writeFile(arquivoFiltros, filtros, "utf-8");
    const saida = path.join(pasta, "final.mp4");

    const args = ["-y", "-i", entradaVideo];
    if (entradaMusica) args.push("-i", entradaMusica);
    for (const arq of arquivosCamadas) args.push("-i", arq);
    args.push(
      "-filter_complex_script",
      escaparCaminho(arquivoFiltros),
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-preset",
      opts.preset ?? "veryfast",
      "-crf",
      String(opts.crf ?? 20),
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(p.fps || 30),
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      "-progress",
      "pipe:1",
      "-nostats",
      saida
    );

    opts.onProgresso?.(0.25, "renderizando");
    await rodarFfmpeg(args, dur, (fracao) => opts.onProgresso?.(0.25 + fracao * 0.7, "renderizando"));

    const info = await fs.stat(saida);
    opts.onProgresso?.(1, "pronto");
    return { arquivo: saida, bytes: info.size, duracao: dur, segundos: (Date.now() - comecou) / 1000 };
  } catch (err) {
    await fs.rm(pasta, { recursive: true, force: true }).catch(() => undefined);
    throw err;
  }
}

/** Roda o ffmpeg acompanhando o progresso pelo tempo já processado. */
function rodarFfmpeg(args: string[], duracao: number, onProgresso?: (f: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(caminhoFfmpeg(), args, { stdio: ["ignore", "pipe", "pipe"] });
    let erro = "";

    proc.stdout.on("data", (b: Buffer) => {
      const texto = b.toString();
      const m = [...texto.matchAll(/out_time_ms=(\d+)/g)].pop();
      if (m && duracao > 0) onProgresso?.(Math.min(0.99, Number(m[1]) / 1_000_000 / duracao));
    });
    proc.stderr.on("data", (b: Buffer) => {
      erro += b.toString();
      if (erro.length > 20000) erro = erro.slice(-8000);
    });

    proc.on("error", (e) => reject(new RenderError(`Não consegui executar o ffmpeg: ${e.message}`)));
    proc.on("close", (codigo) => {
      if (codigo === 0) resolve();
      else reject(new RenderError(`ffmpeg terminou com erro (${codigo}).\n${erro.slice(-1500)}`));
    });
  });
}
