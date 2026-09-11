import { waitUntil } from "@vercel/functions";
import { query, queryOne } from "@/lib/db";
import type { AnalysisRow, VideoRow } from "@/lib/types";
import {
  analyzeVideoWithGemini,
  DEFAULT_ANALYSIS_PROMPT,
  GeminiConfigError,
  GeminiRequestError,
} from "@/lib/gemini";
import { fetchMediaUrl } from "@/lib/meta";
import { normalizeCategories } from "@/lib/categories";
import { getVideo } from "@/lib/services/videos";
import { findCompetitorMediaUrl } from "@/lib/services/competitors";

export async function getLatestAnalysis(videoId: string): Promise<AnalysisRow | null> {
  return queryOne<AnalysisRow>(
    `select * from analyses where video_id = $1 order by requested_at desc limit 1`,
    [videoId]
  );
}

export async function listAnalysesForVideo(videoId: string): Promise<AnalysisRow[]> {
  return query<AnalysisRow>(
    `select * from analyses where video_id = $1 order by requested_at desc`,
    [videoId]
  );
}

export async function getAnalysis(id: string): Promise<AnalysisRow | null> {
  return queryOne<AnalysisRow>(`select * from analyses where id = $1`, [id]);
}

export interface UpdateAnalysisInput {
  summary?: string | null;
  transcript?: string | null;
  structure?: string | null;
  hook?: string | null;
  categories?: string[] | null;
  rules_fit?: string | null;
}

/** Edita os campos de uma análise (painel ou Claude do Augusto). Campos omitidos não mudam. */
export async function updateAnalysis(id: string, input: UpdateAnalysisInput): Promise<AnalysisRow | null> {
  const fields: [keyof UpdateAnalysisInput, unknown][] = [
    ["summary", input.summary],
    ["transcript", input.transcript],
    ["structure", input.structure],
    ["hook", input.hook],
    ["categories", input.categories === undefined ? undefined : normalizeCategories(input.categories)],
    ["rules_fit", input.rules_fit],
  ];
  const sets: string[] = [];
  const params: unknown[] = [id];
  for (const [column, value] of fields) {
    if (value === undefined) continue;
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }
  if (!sets.length) return getAnalysis(id);
  return queryOne<AnalysisRow>(`update analyses set ${sets.join(", ")} where id = $1 returning *`, params);
}

export class AnalysisInputError extends Error {}

/** Categorias já usadas, para o Gemini reaproveitar os mesmos nomes. */
export async function listExistingCategories(): Promise<string[]> {
  const rows = await query<{ category: string }>(
    `select distinct unnest(categories) as category from analyses where status = 'done' order by 1`
  );
  return normalizeCategories(rows.map((r) => r.category));
}

/** Texto acrescentado ao fim do prompt com as categorias existentes (fica gravado junto). */
export async function categoriesHint() {
  const existing = await listExistingCategories();
  if (!existing.length) return "";
  return `\n\nCategorias que já existem no sistema: ${existing.join(", ")}. Reutilize exatamente o mesmo nome quando o tema for o mesmo; crie uma categoria nova só se nenhuma servir.`;
}

/**
 * Cria o registro de análise (status 'pending') e dispara o processamento
 * com o Gemini em background, atualizando o mesmo registro para
 * 'processing' -> 'done' | 'error'.
 *
 * Na Vercel, waitUntil mantém a função viva depois da resposta até o
 * processamento terminar (limitado pelo maxDuration da rota que chamou).
 */
export async function requestAnalysis(
  videoId: string,
  requestedBy: string,
  customPrompt?: string | null
): Promise<AnalysisRow> {
  const prompt = (customPrompt?.trim() || DEFAULT_ANALYSIS_PROMPT) + (await categoriesHint());
  const model = process.env.GEMINI_MODEL || "gemini-2.5-pro";
  const video = await getVideo(videoId);
  if (!video) {
    throw new AnalysisInputError(`Vídeo ${videoId} não encontrado.`);
  }
  if (video.media_type === "IMAGE" || video.media_type === "CAROUSEL_ALBUM") {
    throw new AnalysisInputError("Este post é uma imagem/carrossel: o Gemini só analisa vídeos.");
  }
  if (!video.ig_media_id && !video.video_url && !video.blob_url) {
    throw new AnalysisInputError(
      `Vídeo ${videoId} não tem uma URL de vídeo (video_url/blob_url) salva — não dá para enviar ao Gemini.`
    );
  }

  const analysis = await queryOne<AnalysisRow>(
    `insert into analyses (video_id, status, requested_by, prompt, model)
     values ($1, 'pending', $2, $3, $4)
     returning *`,
    [videoId, requestedBy, prompt, model]
  );
  if (!analysis) throw new Error("Falha ao criar registro de análise.");

  waitUntil(
    processAnalysis(analysis.id, video, prompt).catch((err) => {
      console.error(`Erro ao processar análise ${analysis.id}:`, err);
    })
  );

  return analysis;
}

const NO_FILE_HINT =
  "A Meta não libera o arquivo deste vídeo (acontece com reels que usam música licenciada). Baixe o vídeo e envie pelo botão \"Enviar arquivo do vídeo\" na janela da análise.";

/** Link atual do arquivo de vídeo: cópia própria > link novo da Meta > link salvo. */
async function resolveVideoUrl(video: VideoRow): Promise<string> {
  if (video.blob_url) return video.blob_url;
  if (video.ig_media_id && video.source !== "competitor" && video.source !== "hashtag") {
    const fresh = await fetchMediaUrl(video.ig_media_id);
    if (fresh) {
      await query(`update videos set video_url = $2 where id = $1`, [video.id, fresh]);
      return fresh;
    }
  }
  if (video.source === "competitor" && video.competitor_id && video.ig_media_id) {
    const fresh = await findCompetitorMediaUrl(video.competitor_id, video.ig_media_id);
    if (fresh) {
      await query(`update videos set video_url = $2 where id = $1`, [video.id, fresh]);
      return fresh;
    }
    throw new AnalysisInputError(NO_FILE_HINT);
  }
  if (video.video_url) return video.video_url;
  throw new AnalysisInputError(video.source === "hashtag" ? NO_FILE_HINT : `A Meta não devolveu o link do vídeo ${video.id}.`);
}

async function processAnalysis(analysisId: string, video: VideoRow, prompt: string) {
  await query(`update analyses set status = 'processing' where id = $1`, [analysisId]);

  try {
    const videoUrl = await resolveVideoUrl(video);
    const result = await analyzeVideoWithGemini(videoUrl, prompt);
    await query(
      `update analyses set status = 'done', summary = $2, transcript = $3, structure = $4, hook = $5,
              categories = $6, model = $7, raw_response = $8, completed_at = now()
       where id = $1`,
      [
        analysisId,
        result.summary,
        result.transcript,
        result.structure,
        result.hook,
        normalizeCategories(result.categories),
        result.model,
        JSON.stringify(result.raw),
      ]
    );
  } catch (err) {
    const message =
      err instanceof GeminiConfigError || err instanceof GeminiRequestError || err instanceof AnalysisInputError
        ? err.message
        : `Erro inesperado ao analisar vídeo: ${(err as Error).message}`;
    await query(
      `update analyses set status = 'error', error_message = $2, completed_at = now() where id = $1`,
      [analysisId, message]
    );
  }
}
