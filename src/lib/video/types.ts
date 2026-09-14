/**
 * O MOTOR DE VÍDEO da Videoteca.
 *
 * Um projeto de vídeo é só este JSON. Todo o resto (prévia, linha do tempo e
 * exportação) desenha a partir dele, então melhorar o motor é mexer aqui e no
 * pintor (src/lib/video/painter.ts) — nunca em três lugares diferentes.
 *
 * Tempos: TUDO é guardado em segundos do VÍDEO ORIGINAL (o arquivo que o
 * Augusto mandou). Os cortes tiram pedaços desse tempo; a linha do tempo final
 * é o que sobra. As funções no fim do arquivo convertem de um para o outro.
 */
import type { StudioScene } from "@/lib/studio/scenes";

export type LayoutModo = "metadinha" | "cheio" | "tela";

export interface VideoFonte {
  url: string;
  nome?: string | null;
  /** duração do arquivo em segundos (medida no navegador ao carregar) */
  duracao: number;
  largura?: number | null;
  altura?: number | null;
}

export interface TelaClip {
  id: string;
  /** segundos no vídeo original */
  inicio: number;
  fim: number;
  cena: StudioScene;
}

export interface LegendaClip {
  id: string;
  inicio: number;
  fim: number;
  texto: string;
}

export interface Corte {
  inicio: number;
  fim: number;
  motivo?: "silencio" | "manual";
}

export interface Musica {
  url: string;
  nome?: string | null;
  /** 0 a 1 */
  volume: number;
  /** segundo da música em que ela começa a tocar */
  inicioNaMusica: number;
  /** segundos de fade no fim do vídeo */
  fadeOut: number;
}

export interface EstiloLegenda {
  /** altura da fonte em px, medida no quadro de 1080x1920 */
  tamanho: number;
  cor: string;
  fundo: string;
  contorno: boolean;
  posicao: "topo" | "centro" | "rodape";
  maiusculas: boolean;
  /** distância da borda, em fração da altura */
  margem: number;
  /** máximo de caracteres por linha */
  largura: number;
}

export interface VideoProject {
  versao: 1;
  titulo: string;
  largura: number;
  altura: number;
  fps: number;
  fonte: VideoFonte | null;
  layout: {
    modo: LayoutModo;
    /** fração da altura ocupada pelo vídeo no modo metadinha */
    divisao: number;
    fundo: string;
  };
  telas: TelaClip[];
  legendas: LegendaClip[];
  legendaEstilo: EstiloLegenda;
  cortes: Corte[];
  musica: Musica | null;
  volumeFonte: number;
}

export const ESTILO_LEGENDA_PADRAO: EstiloLegenda = {
  tamanho: 54,
  cor: "#FFFFFF",
  fundo: "rgba(0,0,0,0.55)",
  contorno: true,
  posicao: "rodape",
  maiusculas: false,
  margem: 0.08,
  largura: 32,
};

export function projetoVazio(titulo = "Vídeo novo"): VideoProject {
  return {
    versao: 1,
    titulo,
    largura: 1080,
    altura: 1920,
    fps: 30,
    fonte: null,
    layout: { modo: "metadinha", divisao: 0.5, fundo: "#2E2E2E" },
    telas: [],
    legendas: [],
    legendaEstilo: { ...ESTILO_LEGENDA_PADRAO },
    cortes: [],
    musica: null,
    volumeFonte: 1,
  };
}

// ------------------------------------------------- cortes e linha do tempo

export interface Segmento {
  /** início e fim no vídeo original */
  fonteInicio: number;
  fonteFim: number;
  /** onde esse pedaço cai na linha do tempo final */
  tlInicio: number;
  tlFim: number;
}

/** Junta cortes que se encostam e joga fora os inválidos. */
export function normalizarCortes(cortes: Corte[], duracao: number): Corte[] {
  const limpos = (cortes ?? [])
    .map((c) => ({ ...c, inicio: Math.max(0, Math.min(duracao, c.inicio)), fim: Math.max(0, Math.min(duracao, c.fim)) }))
    .filter((c) => c.fim - c.inicio > 0.02)
    .sort((a, b) => a.inicio - b.inicio);

  const juntos: Corte[] = [];
  for (const c of limpos) {
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && c.inicio <= ultimo.fim + 0.01) {
      ultimo.fim = Math.max(ultimo.fim, c.fim);
      if (ultimo.motivo !== c.motivo) ultimo.motivo = "manual";
    } else {
      juntos.push({ ...c });
    }
  }
  return juntos;
}

/** Os pedaços que sobram do vídeo original, já posicionados na linha do tempo. */
export function segmentos(p: VideoProject): Segmento[] {
  const duracao = p.fonte?.duracao ?? 0;
  if (duracao <= 0) return [];
  const cortes = normalizarCortes(p.cortes, duracao);
  const partes: Segmento[] = [];
  let cursor = 0;
  let tl = 0;
  for (const c of cortes) {
    if (c.inicio > cursor) {
      const dur = c.inicio - cursor;
      partes.push({ fonteInicio: cursor, fonteFim: c.inicio, tlInicio: tl, tlFim: tl + dur });
      tl += dur;
    }
    cursor = Math.max(cursor, c.fim);
  }
  if (cursor < duracao) {
    const dur = duracao - cursor;
    partes.push({ fonteInicio: cursor, fonteFim: duracao, tlInicio: tl, tlFim: tl + dur });
  }
  return partes;
}

export function duracaoFinal(p: VideoProject): number {
  const s = segmentos(p);
  return s.length ? s[s.length - 1].tlFim : 0;
}

/** Tempo da linha do tempo → tempo no vídeo original. */
export function paraFonte(p: VideoProject, tl: number): number {
  const partes = segmentos(p);
  for (const s of partes) {
    if (tl < s.tlFim || s === partes[partes.length - 1]) {
      return Math.min(s.fonteFim, s.fonteInicio + Math.max(0, tl - s.tlInicio));
    }
  }
  return 0;
}

/** Tempo no vídeo original → tempo na linha do tempo (null quando caiu dentro de um corte). */
export function paraLinha(p: VideoProject, fonte: number): number | null {
  for (const s of segmentos(p)) {
    if (fonte >= s.fonteInicio && fonte <= s.fonteFim) return s.tlInicio + (fonte - s.fonteInicio);
  }
  return null;
}

/** O segmento em que a linha do tempo está neste instante. */
export function segmentoEm(p: VideoProject, tl: number): Segmento | null {
  const partes = segmentos(p);
  return partes.find((s) => tl >= s.tlInicio && tl < s.tlFim) ?? partes[partes.length - 1] ?? null;
}

// ------------------------------------------------------------------ ajudas

export function mmss(seg: number) {
  const s = Math.max(0, Math.floor(seg));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** "01:23" ou "83" em segundos. */
export function paraSegundos(valor: string | number | undefined, padrao = 0): number {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  const t = String(valor ?? "").trim();
  const m = /^(\d{1,3}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(`0.${m[3]}`) : 0);
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
}

export function novoId() {
  return Math.random().toString(36).slice(2, 10);
}
