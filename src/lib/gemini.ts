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

5. "frames": a leitura VISUAL do vídeo, frame a frame, do início ao fim, no formato "[00:03] ...".
   Régua obrigatória: uma linha a cada 1 ou 2 segundos, NUNCA pulando mais de 2 segundos entre uma linha e a
   seguinte, começando em [00:00] e indo até o último segundo do vídeo. Um vídeo de 60 segundos tem pelo menos
   30 linhas; um de 3 minutos, pelo menos 90. Quando a imagem não mudar, escreva a linha mesmo assim, dizendo o
   que a pessoa está fazendo naquele instante (gesto, expressão, palavra enfatizada).
   Em cada linha descreva o que está na tela naquele momento:
   - enquadramento e câmera (close, meio corpo, selfie na mão, tripé, zoom, movimento, corte seco);
   - o que a pessoa faz: gesto, postura, expressão facial, para onde olha;
   - cenário, roupa, objetos e o que aparece ao fundo;
   - TODO texto que aparece na tela, copiado palavra por palavra (headline, legenda queimada, emoji, sticker, seta,
     destaque, marca d'água), com a posição aproximada (topo, centro, rodapé);
   - inserções: b-roll, print, gráfico, imagem, meme, mudança de cena;
   - como está a voz nesse trecho: tom (calmo, indignado, provocativo, animado), ritmo, volume, ênfase e pausas.
   Percorra o vídeo inteiro, mesmo que seja longo. Esta parte precisa ser detalhada o suficiente para alguém
   remontar a cena sem assistir ao vídeo.

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
export async function generateJsonWithGemini<T>(prompt: string, schema: object): Promise<{ result: T; model: string; raw: unknown }> {
  const apiKey = requireApiKey();
  const model = modelName();
  const res = await fetch(`${GEMINI_API_BASE}/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema },
    }),
  });
  if (!res.ok) {
    throw new GeminiRequestError(`Gemini retornou erro (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  try {
    return { result: JSON.parse(text) as T, model, raw: data };
  } catch {
    throw new GeminiRequestError(`O Gemini respondeu fora do formato esperado: ${text.slice(0, 300)}`);
  }
}
