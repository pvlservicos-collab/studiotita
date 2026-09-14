/**
 * Cortes nos momentos de silêncio.
 *
 * A conta é feita no navegador, em cima do áudio já decodificado: a faixa é
 * varrida em janelas de 20 ms, cada janela vira um volume em dB, e as sequências
 * abaixo do limiar por tempo suficiente viram corte. Sobra sempre uma folga nas
 * pontas para a fala não ficar "cortada na respiração".
 */

export interface OpcoesSilencio {
  /** abaixo disso é considerado silêncio (dBFS). -45 pega respiração e sala vazia. */
  limiar?: number;
  /** só corta silêncios maiores que isso (segundos) */
  minimo?: number;
  /** folga mantida no começo e no fim de cada corte (segundos) */
  folga?: number;
  /** nunca corta os primeiros segundos (o gancho) */
  protegerInicio?: number;
  /** nem os últimos (o CTA) */
  protegerFim?: number;
}

export interface FaixaSilencio {
  inicio: number;
  fim: number;
}

export interface AnaliseSilencio {
  /** volume por janela, em dB, para desenhar a onda */
  niveis: Float32Array;
  janela: number;
  duracao: number;
  silencios: FaixaSilencio[];
  cortes: FaixaSilencio[];
  tempoCortado: number;
}

const JANELA = 0.02;

/** Volume (dB) de cada janela de 20 ms do áudio. */
export function niveisDeAudio(buffer: AudioBuffer, janela = JANELA): Float32Array {
  const canais = Math.min(2, buffer.numberOfChannels);
  const porJanela = Math.max(1, Math.floor(buffer.sampleRate * janela));
  const total = Math.ceil(buffer.length / porJanela);
  const saida = new Float32Array(total);
  const dados: Float32Array[] = [];
  for (let c = 0; c < canais; c++) dados.push(buffer.getChannelData(c));

  for (let j = 0; j < total; j++) {
    const ini = j * porJanela;
    const fim = Math.min(buffer.length, ini + porJanela);
    let soma = 0;
    let n = 0;
    for (let i = ini; i < fim; i += 2) {
      for (const d of dados) {
        const v = d[i];
        soma += v * v;
        n++;
      }
    }
    const rms = n ? Math.sqrt(soma / n) : 0;
    saida[j] = rms > 0 ? 20 * Math.log10(rms) : -100;
  }
  return saida;
}

/** Acha os silêncios e transforma em cortes, respeitando folga e proteções. */
export function analisarSilencio(buffer: AudioBuffer, opts: OpcoesSilencio = {}): AnaliseSilencio {
  const limiar = opts.limiar ?? -45;
  const minimo = opts.minimo ?? 0.35;
  const folga = opts.folga ?? 0.08;
  const protegerInicio = opts.protegerInicio ?? 0;
  const protegerFim = opts.protegerFim ?? 0;

  const niveis = niveisDeAudio(buffer);
  const duracao = buffer.duration;
  const silencios: FaixaSilencio[] = [];

  let inicio: number | null = null;
  for (let j = 0; j < niveis.length; j++) {
    const quieto = niveis[j] < limiar;
    const t = j * JANELA;
    if (quieto && inicio == null) inicio = t;
    if (!quieto && inicio != null) {
      if (t - inicio >= minimo) silencios.push({ inicio, fim: t });
      inicio = null;
    }
  }
  if (inicio != null && duracao - inicio >= minimo) silencios.push({ inicio, fim: duracao });

  const cortes: FaixaSilencio[] = [];
  for (const s of silencios) {
    const ini = s.inicio + folga;
    const fim = s.fim - folga;
    if (fim - ini < 0.12) continue;
    if (fim <= protegerInicio) continue;
    if (protegerFim > 0 && ini >= duracao - protegerFim) continue;
    cortes.push({
      inicio: Math.max(ini, protegerInicio),
      fim: protegerFim > 0 ? Math.min(fim, duracao - protegerFim) : fim,
    });
  }

  return {
    niveis,
    janela: JANELA,
    duracao,
    silencios,
    cortes,
    tempoCortado: cortes.reduce((s, c) => s + (c.fim - c.inicio), 0),
  };
}

/**
 * Onda simplificada para desenhar na linha do tempo: `pontos` valores de 0 a 1.
 */
export function ondaParaDesenho(niveis: Float32Array, pontos: number): number[] {
  const saida: number[] = [];
  const passo = Math.max(1, Math.floor(niveis.length / pontos));
  for (let i = 0; i < niveis.length; i += passo) {
    let pico = -100;
    for (let k = i; k < Math.min(niveis.length, i + passo); k++) pico = Math.max(pico, niveis[k]);
    // -60 dB = silêncio total, 0 dB = máximo
    saida.push(Math.max(0, Math.min(1, (pico + 60) / 60)));
  }
  return saida;
}

/** Baixa o áudio de uma URL e decodifica (usa o mesmo arquivo do vídeo). */
export async function carregarAudio(url: string, onProgresso?: (p: number) => void): Promise<AudioBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não deu para baixar o áudio (status ${res.status}).`);
  const total = Number(res.headers.get("content-length") || 0);
  let bytes: Uint8Array;

  if (res.body && total && onProgresso) {
    const leitor = res.body.getReader();
    const partes: Uint8Array[] = [];
    let lido = 0;
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      if (value) {
        partes.push(value);
        lido += value.length;
        onProgresso(Math.min(0.95, lido / total));
      }
    }
    bytes = new Uint8Array(lido);
    let pos = 0;
    for (const p of partes) {
      bytes.set(p, pos);
      pos += p.length;
    }
  } else {
    bytes = new Uint8Array(await res.arrayBuffer());
  }

  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    const buffer = await ctx.decodeAudioData(bytes.buffer as ArrayBuffer);
    onProgresso?.(1);
    return buffer;
  } finally {
    ctx.close();
  }
}
