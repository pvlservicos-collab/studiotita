/**
 * As camadas do vídeo desenhadas NO SERVIDOR.
 *
 * Usa o MESMO pintor da prévia (src/lib/video/painter.ts), só que com o canvas
 * do Node (@napi-rs/canvas). É isso que garante que o arquivo renderizado no
 * servidor sai igual ao que você vê no editor: uma implementação só.
 *
 * Cada camada vira um PNG recortado no tamanho do que foi desenhado, com o
 * tempo (já na linha do tempo final) em que ela entra e sai. O ffmpeg depois
 * sobrepõe cada uma no vídeo.
 */
import path from "node:path";
import { createCanvas, GlobalFonts, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { pintarCena, pintarLegenda, pintarTexto } from "@/lib/video/painter";
import { layoutEm, paraLinha, segmentos, type VideoProject } from "@/lib/video/types";

export interface Camada {
  png: Buffer;
  x: number;
  y: number;
  /** segundos na linha do tempo final */
  inicio: number;
  fim: number;
  tipo: "tela" | "texto" | "legenda";
}

let fontesProntas = false;

/** Registra as fontes de fontes/ (as mesmas do editor) no canvas do Node. */
export function registrarFontes() {
  if (fontesProntas) return;
  const dir = path.join(process.cwd(), "fontes");
  try {
    GlobalFonts.loadFontsFromDir(dir);
  } catch (err) {
    console.warn("Não consegui carregar as fontes de", dir, (err as Error).message);
  }
  fontesProntas = true;
}

/** A área da tela do estúdio dentro do quadro, conforme o layout. */
export function areaDaCena(p: VideoProject, tempoFonte: number) {
  const L = p.largura;
  const A = p.altura;
  const { modo, divisao } = layoutEm(p, tempoFonte);
  const d = Math.min(0.9, Math.max(0.1, divisao || 0.5));
  if (modo === "metadinha") return { x: 0, y: A * d, w: L, h: A * (1 - d) };
  if (modo === "metadinha-topo") return { x: 0, y: 0, w: L, h: A * (1 - d) };
  if (modo === "tela") return { x: 0, y: 0, w: L, h: A };
  return { x: 24, y: A * 0.58, w: L - 48, h: A * 0.42 - 24 };
}

/** A área do vídeo dentro do quadro, conforme o layout. */
export function areaDoVideo(p: VideoProject) {
  const L = p.largura;
  const A = p.altura;
  const { modo, divisao } = layoutEm(p, 0);
  const d = Math.min(0.9, Math.max(0.1, divisao || 0.5));
  if (modo === "metadinha") return { x: 0, y: 0, w: L, h: Math.round((A * d) / 2) * 2 };
  if (modo === "metadinha-topo") return { x: 0, y: Math.round((A * (1 - d)) / 2) * 2, w: L, h: Math.round((A * d) / 2) * 2 };
  if (modo === "tela") return null;
  return { x: 0, y: 0, w: L, h: A };
}

/** Intervalo do vídeo original convertido para a linha do tempo final. */
export function intervaloNaLinha(p: VideoProject, inicio: number, fim: number) {
  const partes = segmentos(p);
  if (!partes.length) return null;
  const dentro = (t: number) => partes.find((s) => t >= s.fonteInicio && t <= s.fonteFim);

  const sIni = dentro(inicio) ?? partes.find((s) => s.fonteInicio >= inicio);
  const sFim = dentro(fim) ?? [...partes].reverse().find((s) => s.fonteFim <= fim);
  if (!sIni || !sFim) return null;

  const tlInicio = paraLinha(p, Math.max(inicio, sIni.fonteInicio)) ?? sIni.tlInicio;
  const tlFim = paraLinha(p, Math.min(fim, sFim.fonteFim)) ?? sFim.tlFim;
  if (tlFim <= tlInicio) return null;
  return { inicio: tlInicio, fim: tlFim };
}

/** Recorta o PNG no retângulo do que foi desenhado (menos bytes, overlay mais barato). */
function recortar(canvas: Canvas, ctx: SKRSContext2D, L: number, A: number) {
  const dados = ctx.getImageData(0, 0, L, A).data;
  let x0 = L;
  let y0 = A;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < A; y++) {
    for (let x = 0; x < L; x++) {
      if (dados[(y * L + x) * 4 + 3] > 4) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0 || y1 < y0) return null;
  // margem de 2px e coordenadas pares (o ffmpeg gosta)
  x0 = Math.max(0, (x0 - 2) & ~1);
  y0 = Math.max(0, (y0 - 2) & ~1);
  const w = Math.min(L - x0, x1 - x0 + 4);
  const h = Math.min(A - y0, y1 - y0 + 4);
  const corte = createCanvas(w, h);
  corte.getContext("2d").drawImage(canvas as never, -x0, -y0);
  return { png: corte.toBuffer("image/png"), x: x0, y: y0 };
}

/**
 * Desenha todas as camadas do projeto (telas do estúdio, textos e legendas).
 * O vídeo em si não entra aqui: quem posiciona e corta o vídeo é o ffmpeg.
 */
export function montarCamadas(p: VideoProject): Camada[] {
  registrarFontes();
  const L = p.largura;
  const A = p.altura;
  const camadas: Camada[] = [];

  const nova = () => {
    const canvas = createCanvas(L, A);
    const ctx = canvas.getContext("2d");
    return { canvas, ctx };
  };

  for (const tela of p.telas ?? []) {
    const quando = intervaloNaLinha(p, tela.inicio, tela.fim);
    if (!quando) continue;
    const { canvas, ctx } = nova();
    pintarCena(ctx as unknown as CanvasRenderingContext2D, tela.cena, areaDaCena(p, tela.inicio));
    const corte = recortar(canvas, ctx, L, A);
    if (corte) camadas.push({ ...corte, ...quando, tipo: "tela" });
  }

  for (const texto of p.textos ?? []) {
    const quando = intervaloNaLinha(p, texto.inicio, texto.fim);
    if (!quando) continue;
    const { canvas, ctx } = nova();
    pintarTexto(ctx as unknown as CanvasRenderingContext2D, texto, L, A);
    const corte = recortar(canvas, ctx, L, A);
    if (corte) camadas.push({ ...corte, ...quando, tipo: "texto" });
  }

  for (const legenda of p.legendas ?? []) {
    const quando = intervaloNaLinha(p, legenda.inicio, legenda.fim);
    if (!quando) continue;
    const { canvas, ctx } = nova();
    // o pintor escolhe a legenda pelo tempo: mira no meio do trecho
    pintarLegenda(ctx as unknown as CanvasRenderingContext2D, p, (legenda.inicio + legenda.fim) / 2);
    const corte = recortar(canvas, ctx, L, A);
    if (corte) camadas.push({ ...corte, ...quando, tipo: "legenda" });
  }

  return camadas.sort((a, b) => a.inicio - b.inicio);
}
