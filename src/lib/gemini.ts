/**
 * Integração com o Gemini para análise de vídeo.
 *
 * Fluxo (File API do Gemini):
 *   1. Baixa os bytes do vídeo (video_url / blob_url do registro em `videos`).
 *   2. Faz upload resumable para o Gemini File API -> recebe um `file.uri`.
 *   3. Aguarda o arquivo ficar com state ACTIVE.
 *   4. Chama generateContent com o vídeo + um prompt pedindo resumo,
 *      padrões/roteiro e o gancho usado.
 *
 * O nome do modelo é configurável via GEMINI_MODEL (.env.local) — ajuste
 * para o modelo de vídeo mais recente disponível na sua conta (ex.: a
 * família "gemini-3" com suporte a vídeo, quando disponível para você).
 *
 * Referência: https://ai.google.dev/gemini-api/docs/video-understanding
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";

export class GeminiConfigError extends Error {}
export class GeminiRequestError extends Error {}

function requireApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new GeminiConfigError(
      "GEMINI_API_KEY não configurada. Defina no .env.local (veja .env.example)."
    );
  }
  return key;
}

function modelName(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-pro";
}

interface UploadedFile {
  uri: string;
  mimeType: string;
  name: string;
}

/**
 * Faz upload resumable de um vídeo (a partir de uma URL pública) para o
 * Gemini File API. Retorna o `uri` do arquivo já pronto para uso.
 */
async function uploadVideoToGemini(videoUrl: string): Promise<UploadedFile> {
  const apiKey = requireApiKey();

  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok || !videoRes.body) {
    throw new GeminiRequestError(
      `Não foi possível baixar o vídeo em ${videoUrl} (status ${videoRes.status}).`
    );
  }
  const mimeType = videoRes.headers.get("content-type") || "video/mp4";
  const buffer = Buffer.from(await videoRes.arrayBuffer());

  // Passo 1: iniciar upload resumable
  const startRes = await fetch(
    `${GEMINI_API_BASE}/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(buffer.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: `videoteca-ig-${Date.now()}` } }),
    }
  );

  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!startRes.ok || !uploadUrl) {
    const body = await startRes.text();
    throw new GeminiRequestError(`Falha ao iniciar upload no Gemini File API: ${body}`);
  }

  // Passo 2: enviar os bytes
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(buffer.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    throw new GeminiRequestError(`Falha ao enviar bytes do vídeo para o Gemini: ${body}`);
  }

  const uploaded = await uploadRes.json();
  const file = uploaded.file;
  if (!file?.uri) {
    throw new GeminiRequestError("Resposta inesperada do Gemini File API (sem file.uri).");
  }

  return { uri: file.uri, mimeType, name: file.name };
}

async function waitUntilActive(fileName: string, apiKey: string, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${GEMINI_API_BASE}/v1beta/${fileName}?key=${apiKey}`);
    if (!res.ok) break;
    const data = await res.json();
    if (data.state === "ACTIVE") return;
    if (data.state === "FAILED") {
      throw new GeminiRequestError("Processamento do vídeo falhou no Gemini File API.");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export interface GeminiAnalysisResult {
  summary: string;
  transcript: string;
  structure: string;
  hook: string;
  frames: string;
  categories: string[];
  prompt: string;
  model: string;
  raw: unknown;
}

/**
 * Prompt padrão. Quem pede a análise (painel ou Claude do Augusto) pode
 * mandar outro; o usado fica gravado em analyses.prompt.
 */
export const DEFAULT_ANALYSIS_PROMPT = `Você é um analista de conteúdo especializado em vídeos curtos do Instagram (Reels).
Assista ao vídeo inteiro, olhando os quadros (frames) e ouvindo o áudio, e responda em português do Brasil.
Responda de forma COMPLETA em todos os campos, do primeiro ao último segundo. Não resuma, não corte, não pule
trechos e não economize espaço: esta análise é usada para reconstruir o vídeo e escrever roteiros novos.

Preencha seis campos:

1. "resumo": um resumo objetivo do vídeo — do que ele trata, a mensagem principal, o tom, o ritmo, a edição e o CTA usado.

2. "transcricao": a transcrição completa e literal de tudo o que é falado, do início ao fim, sem resumir nem
   corrigir a fala. Marque o tempo no formato [mm:ss] no início de cada frase ou troca de ideia. Textos que
   aparecem escritos na tela entram entre colchetes, ex.: [texto na tela: "..."].

3. "estrutura": a ENGENHARIA REVERSA da narrativa, com olhar de marketing digital. Não descreva o que aparece
   na tela; explique por que cada parte existe e o que ela provoca em quem assiste. Divida o vídeo nas partes
   da narrativa, do início ao fim, uma linha por parte, no formato:
   "[0s–3s] FUNÇÃO · gatilho: ... · emoção: ... · como foi construído: ..."
   - FUNÇÃO: o papel da parte (gancho, quebra de padrão, identificação com a dor, promessa, prova,
     conteúdo/mecanismo, virada, alerta/consequência, solução, CTA de salvar, de compartilhar, de comentar...).
   - gatilho: o gatilho mental usado (curiosidade, dor, medo de perder, identificação, contraste, autoridade,
     prova social, especificidade, urgência, pertencimento, reciprocidade, novidade...).
   - emoção: a emoção que a parte quer transmitir ou provocar (indignação, alívio, culpa, esperança, surpresa...).
   - como foi construído: a técnica (pergunta, número forte, lista, história, analogia, pausa, tom de voz...).
   Depois das partes, feche com duas linhas:
   "Arco da narrativa: ..." (o desenho do vídeo numa frase, ex.: começa emocional com uma dor, no meio
   explica os 3 itens, no fim fecha com CTA de comentário) e
   "Aprendizados para replicar: ..." (2 a 4 lições práticas para usar em outros roteiros).

4. "gancho": o gancho do vídeo, ou seja, os primeiros segundos que prendem a atenção. Traga a fala exata
   (verbal), o texto na tela (textual), o que aparece na imagem (visual), quantos segundos dura e qual
   técnica ele usa (acusar um erro, negar uma crença, abrir uma lacuna de curiosidade, promessa, etc.).

5. "frames": a leitura do vídeo momento a momento, do início ao fim, SEMPRE neste esquema, um bloco por momento:

[mm:ss]
TELA: o que aparece na imagem: enquadramento e câmera (close, meio corpo, selfie na mão, tripé, zoom, corte seco),
      cenário, roupa, objetos, e qualquer inserção (b-roll, print, gráfico, imagem, meme, animação).
LAYOUT: como a tela está dividida e onde cada coisa fica (tela cheia, split-screen com a pessoa em cima e o
      conteúdo embaixo, painel lateral, moldura, legenda no rodapé, cor de fundo predominante).
TEXTO NA TELA: todo texto visível copiado palavra por palavra, com a posição (topo, centro, rodapé) e o estilo
      (caixa alta, destaque colorido, emoji, sticker, seta, marca d'água). Se não houver, escreva "nenhum".
FALA: o que está sendo dito nesse momento, entre aspas.
VOZ: tom (calmo, indignado, provocativo, animado, irônico), ritmo, volume, ênfase em palavras e pausas.
AÇÃO: o que a pessoa faz: gesto, postura, expressão facial, para onde olha, o que aponta.

   Régua obrigatória: um bloco a cada 1 ou 2 segundos, NUNCA pulando mais de 2 segundos entre um bloco e o
   seguinte, começando em [00:00] e indo até o último segundo. Um vídeo de 60 segundos tem pelo menos 30 blocos;
   um de 3 minutos, pelo menos 90. Quando a imagem não mudar, escreva "TELA: mesma cena" e "LAYOUT: igual", mas
   preencha FALA, VOZ e AÇÃO daquele instante. Esta parte precisa ser detalhada o suficiente para alguém remontar
   a cena sem assistir ao vídeo.

6. "categorias": de 1 a 3 categorias (temas) abordadas no vídeo, com nomes curtos em português
   (ex.: "Gestão de tempo", "Política", "Organização", "Alta performance", "Filosofia").`;

// A resposta sempre volta nesses campos, mesmo com prompt personalizado.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    resumo: { type: "STRING" },
    transcricao: { type: "STRING" },
    estrutura: { type: "STRING" },
    gancho: { type: "STRING" },
    frames: { type: "STRING" },
    categorias: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["resumo", "transcricao", "estrutura", "gancho", "frames", "categorias"],
};

/**
 * Faz o fluxo completo: upload do vídeo + geração de análise.
 * Lança GeminiConfigError se faltar configuração, GeminiRequestError se a
 * chamada à API falhar — a rota que chama isso decide como reportar.
 */
export async function analyzeVideoWithGemini(
  videoUrl: string,
  prompt: string = DEFAULT_ANALYSIS_PROMPT
): Promise<GeminiAnalysisResult> {
  const apiKey = requireApiKey();
  const model = modelName();
  const uploaded = await uploadVideoToGemini(videoUrl);
  await waitUntilActive(uploaded.name, apiKey);

  // fps mais alto = mais quadros analisados (a leitura frame a frame fica melhor);
  // maxOutputTokens alto porque a resposta completa é longa.
  const pedido = (comVideoMetadata: boolean) => ({
    contents: [
      {
        role: "user",
        parts: [
          {
            file_data: { file_uri: uploaded.uri, mime_type: uploaded.mimeType },
            ...(comVideoMetadata ? { video_metadata: { fps: 2 } } : {}),
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 32768,
      temperature: 0.6,
    },
  });

  const chamar = (comVideoMetadata: boolean) =>
    fetch(`${GEMINI_API_BASE}/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido(comVideoMetadata)),
    });

  let res = await chamar(true);
  if (!res.ok) {
    // modelos que não aceitam video_metadata: refaz sem esse pedaço
    const body = await res.text();
    if (/video_metadata|videoMetadata|Unknown name/i.test(body)) res = await chamar(false);
    else
      throw new GeminiRequestError(
        `Gemini retornou erro (${res.status}) ao gerar a análise: ${body}. Verifique GEMINI_MODEL e GEMINI_API_KEY.`
      );
  }

  if (!res.ok) {
    const body = await res.text();
    throw new GeminiRequestError(
      `Gemini retornou erro (${res.status}) ao gerar a análise: ${body}. Verifique GEMINI_MODEL e GEMINI_API_KEY.`
    );
  }

  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";

  let parsed: { resumo?: string; transcricao?: string; estrutura?: string; gancho?: string; frames?: string; categorias?: string[] } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    // Resposta fora do formato: guarda o texto inteiro como resumo.
    parsed = { resumo: text };
  }

  return {
    summary: (parsed.resumo ?? "").trim(),
    transcript: (parsed.transcricao ?? "").trim(),
    structure: (parsed.estrutura ?? "").trim(),
    hook: (parsed.gancho ?? "").trim(),
    frames: (parsed.frames ?? "").trim(),
    categories: Array.isArray(parsed.categorias) ? parsed.categorias.map((c) => String(c)) : [],
    prompt,
    model,
    raw: data,
  };
}

/**
 * Pedido só de texto ao Gemini (sem vídeo), com resposta em JSON no formato
 * do schema. Usado para gerar roteiros novos a partir de uma categoria.
 */
export async function generateJsonWithGemini<T>(
  prompt: string,
  schema: object,
  opts: { maxOutputTokens?: number; temperature?: number } = {}
): Promise<{ result: T; model: string; raw: unknown }> {
  const apiKey = requireApiKey();
  const model = modelName();
  const res = await fetch(`${GEMINI_API_BASE}/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
        ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
      },
    }),
  });
  if (!res.ok) {
    throw new GeminiRequestError(`Gemini retornou erro (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  const finish = data?.candidates?.[0]?.finishReason;
  try {
    return { result: JSON.parse(text) as T, model, raw: data };
  } catch {
    if (finish === "MAX_TOKENS") {
      throw new GeminiRequestError(
        "A resposta do Gemini foi cortada no meio (limite de tokens). Peça menos itens ou aumente maxOutputTokens."
      );
    }
    throw new GeminiRequestError(`O Gemini respondeu fora do formato esperado (${finish ?? "sem motivo"}): ${text.slice(0, 300)}`);
  }
}

/**
 * Transcrição com tempo de início e fim de cada trecho — usada para a legenda
 * automática da aba Vídeo, quando o arquivo é novo (ainda não tem análise).
 */
export interface TrechoFala {
  inicio: number;
  fim: number;
  texto: string;
}

const TRANSCRICAO_SCHEMA = {
  type: "OBJECT",
  properties: {
    trechos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          inicio: { type: "NUMBER" },
          fim: { type: "NUMBER" },
          texto: { type: "STRING" },
        },
        required: ["inicio", "fim", "texto"],
      },
    },
  },
  required: ["trechos"],
};

export async function transcribeVideoWithGemini(videoUrl: string): Promise<{ trechos: TrechoFala[]; model: string }> {
  const apiKey = requireApiKey();
  const model = modelName();
  const uploaded = await uploadVideoToGemini(videoUrl);
  await waitUntilActive(uploaded.name, apiKey);

  const prompt = `Transcreva a fala deste vídeo em português do Brasil, do primeiro ao último segundo.
Devolva "trechos": uma lista em ordem, cada um com "inicio" e "fim" em SEGUNDOS (número, pode ter decimal) e "texto" com a fala literal daquele intervalo.
Cada trecho deve ter entre 1 e 4 segundos e no máximo 90 caracteres — é para virar legenda na tela.
Não descreva imagens, não escreva nada que não seja falado, não invente pontuação que mude o sentido.`;

  const res = await fetch(`${GEMINI_API_BASE}/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ file_data: { file_uri: uploaded.uri, mime_type: uploaded.mimeType } }, { text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: TRANSCRICAO_SCHEMA,
        maxOutputTokens: 32768,
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    throw new GeminiRequestError(`Gemini retornou erro (${res.status}) ao transcrever: ${await res.text()}`);
  }
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  try {
    const parsed = JSON.parse(text) as { trechos?: TrechoFala[] };
    const trechos = (parsed.trechos ?? [])
      .map((t) => ({ inicio: Number(t.inicio) || 0, fim: Number(t.fim) || 0, texto: String(t.texto ?? "").trim() }))
      .filter((t) => t.texto && t.fim > t.inicio);
    return { trechos, model };
  } catch {
    throw new GeminiRequestError(`O Gemini respondeu fora do formato esperado na transcrição: ${text.slice(0, 200)}`);
  }
}
