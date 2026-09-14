/**
 * Legendas automáticas.
 *
 * Duas fontes:
 *  - a transcrição que o Gemini já gerou na análise do vídeo (marcada com
 *    [mm:ss] a cada frase);
 *  - a transcrição do arquivo enviado, pedida ao Gemini na hora (aí já vem com
 *    início e fim de cada trecho).
 *
 * Em ambos os casos o texto é quebrado em pedaços curtos, do tamanho que cabe
 * na tela do reel, e cada pedaço ganha um tempo proporcional ao número de
 * caracteres — é o que dá a sensação de legenda acompanhando a fala.
 */
import { novoId, type LegendaClip } from "@/lib/video/types";

/** Quebra um texto em linhas de no máximo `largura` caracteres, sem cortar palavra. */
export function quebrarTexto(texto: string, largura: number): string[] {
  const palavras = String(texto ?? "").trim().split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    if (!atual.length) atual = p;
    else if (atual.length + 1 + p.length <= largura) atual += ` ${p}`;
    else {
      linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Tira as marcações da transcrição que não são fala. */
function limparFala(texto: string) {
  return texto
    .replace(/\[(texto na tela|comentário na tela|na tela)[^\]]*\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface TrechoTranscricao {
  inicio: number;
  fim?: number;
  texto: string;
}

/**
 * Lê a transcrição no formato "[00:12] fala..." e devolve os trechos com o
 * tempo de início de cada um.
 */
export function lerTranscricaoMarcada(transcricao: string): TrechoTranscricao[] {
  const texto = String(transcricao ?? "");
  const marcas = [...texto.matchAll(/\[(\d{1,3}):(\d{2})(?::(\d{2}))?\]/g)];
  if (!marcas.length) return [];
  const trechos: TrechoTranscricao[] = [];
  marcas.forEach((m, i) => {
    // [mm:ss] ou [hh:mm:ss]
    const inicio = m[3] ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2]);
    const de = (m.index ?? 0) + m[0].length;
    const ate = i + 1 < marcas.length ? marcas[i + 1].index ?? texto.length : texto.length;
    const fala = limparFala(texto.slice(de, ate));
    if (fala) trechos.push({ inicio, texto: fala });
  });
  for (let i = 0; i < trechos.length; i++) {
    trechos[i].fim = trechos[i + 1]?.inicio;
  }
  return trechos;
}

export interface OpcoesLegenda {
  /** caracteres por pedaço de legenda (2 linhas cabem bem no reel) */
  tamanho?: number;
  /** tempo mínimo de cada legenda na tela */
  minimo?: number;
  /** duração do vídeo, para fechar o último trecho */
  duracao?: number;
  /** velocidade de leitura usada quando o trecho não tem fim (caracteres por segundo) */
  cps?: number;
}

/**
 * Transforma trechos de transcrição em legendas curtas com início e fim.
 * O tempo de cada pedaço é proporcional ao tamanho do texto dentro do trecho.
 */
export function legendasDeTrechos(trechos: TrechoTranscricao[], opts: OpcoesLegenda = {}): LegendaClip[] {
  const tamanho = opts.tamanho ?? 64;
  const minimo = opts.minimo ?? 0.9;
  const cps = opts.cps ?? 15;
  const saida: LegendaClip[] = [];

  trechos.forEach((t, i) => {
    const texto = limparFala(t.texto);
    if (!texto) return;
    const proximo = trechos[i + 1]?.inicio;
    const fimTrecho = t.fim ?? proximo ?? Math.min(t.inicio + texto.length / cps, opts.duracao ?? Infinity);
    const dur = Math.max(minimo, (Number.isFinite(fimTrecho) ? fimTrecho : t.inicio + texto.length / cps) - t.inicio);

    const pedacos = dividirEmPedacos(texto, tamanho);
    const total = pedacos.reduce((s, p) => s + p.length, 0) || 1;
    let cursor = t.inicio;
    for (const p of pedacos) {
      const fatia = Math.max(minimo, (p.length / total) * dur);
      saida.push({ id: novoId(), inicio: Number(cursor.toFixed(2)), fim: Number((cursor + fatia).toFixed(2)), texto: p });
      cursor += fatia;
    }
  });

  // não deixa uma legenda passar por cima da próxima
  for (let i = 0; i < saida.length - 1; i++) {
    if (saida[i].fim > saida[i + 1].inicio) saida[i].fim = Number(saida[i + 1].inicio.toFixed(2));
  }
  return saida.filter((l) => l.fim > l.inicio);
}

/** Corta o texto em pedaços de leitura, preferindo quebrar na pontuação. */
export function dividirEmPedacos(texto: string, tamanho: number): string[] {
  const frases = texto.split(/(?<=[.!?…])\s+/);
  const pedacos: string[] = [];
  for (const frase of frases) {
    if (frase.length <= tamanho) {
      if (frase.trim()) pedacos.push(frase.trim());
      continue;
    }
    // frase longa: quebra em vírgulas e depois em palavras
    let atual = "";
    for (const parte of frase.split(/(?<=,)\s+/)) {
      if (!atual.length) atual = parte;
      else if (atual.length + 1 + parte.length <= tamanho) atual += ` ${parte}`;
      else {
        pedacos.push(atual.trim());
        atual = parte;
      }
      while (atual.length > tamanho) {
        const corte = atual.lastIndexOf(" ", tamanho);
        pedacos.push(atual.slice(0, corte > 20 ? corte : tamanho).trim());
        atual = atual.slice(corte > 20 ? corte : tamanho).trim();
      }
    }
    if (atual.trim()) pedacos.push(atual.trim());
  }
  return pedacos.filter(Boolean);
}

/** Caminho curto: transcrição marcada → legendas prontas. */
export function legendasDaTranscricao(transcricao: string, opts: OpcoesLegenda = {}): LegendaClip[] {
  return legendasDeTrechos(lerTranscricaoMarcada(transcricao), opts);
}
