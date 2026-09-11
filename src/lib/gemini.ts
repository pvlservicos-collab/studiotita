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
  prompt: string;
  model: string;
  raw: unknown;
}

/**
 * Prompt padrão. Quem pede a análise (painel ou Claude do Augusto) pode
 * mandar outro; o usado fica gravado em analyses.prompt.
 */
export const DEFAULT_ANALYSIS_PROMPT = `Você é um analista de conteúdo especializado em vídeos curtos do Instagram (Reels).
Assista ao vídeo inteiro e responda em português do Brasil, preenchendo dois campos:

1. "resumo": um resumo objetivo do vídeo — do que ele trata, a mensagem principal, o tom, o ritmo e a edição,
   o gancho dos 3 primeiros segundos, a estrutura (abertura, desenvolvimento, fechamento) e o CTA usado.

2. "transcricao": a transcrição completa e literal de tudo o que é falado, do início ao fim, sem resumir nem
   corrigir a fala. Marque o tempo no formato [mm:ss] no início de cada frase ou troca de ideia. Textos que
   aparecem escritos na tela entram entre colchetes, ex.: [texto na tela: "..."].`;

// A resposta sempre volta nesses dois campos, mesmo com prompt personalizado.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    resumo: { type: "STRING" },
    transcricao: { type: "STRING" },
  },
  required: ["resumo", "transcricao"],
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

  const res = await fetch(
    `${GEMINI_API_BASE}/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { file_data: { file_uri: uploaded.uri, mime_type: uploaded.mimeType } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new GeminiRequestError(
      `Gemini retornou erro (${res.status}) ao gerar a análise: ${body}. Verifique GEMINI_MODEL e GEMINI_API_KEY.`
    );
  }

  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";

  let parsed: { resumo?: string; transcricao?: string } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    // Resposta fora do formato: guarda o texto inteiro como resumo.
    parsed = { resumo: text };
  }

  return {
    summary: (parsed.resumo ?? "").trim(),
    transcript: (parsed.transcricao ?? "").trim(),
    prompt,
    model,
    raw: data,
  };
}
