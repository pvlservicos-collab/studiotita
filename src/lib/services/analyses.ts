import { query, queryOne } from "@/lib/db";
import type { AnalysisRow } from "@/lib/types";
import { analyzeVideoWithGemini, GeminiConfigError, GeminiRequestError } from "@/lib/gemini";
import { getVideo } from "@/lib/services/videos";

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

export class AnalysisInputError extends Error {}

/**
 * Cria o registro de análise (status 'pending') e dispara o processamento
 * com o Gemini em background, atualizando o mesmo registro para
 * 'processing' -> 'done' | 'error'.
 *
 * Nota de deploy: em runtime serverless (Vercel), uma função normalmente
 * encerra assim que a resposta é enviada, o que pode matar este
 * processamento em background. Para produção, considere mover este bloco
 * para uma fila (ex.: Vercel Queues / QStash) ou usar `after()` do Next.js
 * quando disponível na sua versão. Rodando com `next start` num processo
 * long-running isso funciona normalmente.
 */
export async function requestAnalysis(
  videoId: string,
  requestedBy: string
): Promise<AnalysisRow> {
  const video = await getVideo(videoId);
  if (!video) {
    throw new AnalysisInputError(`Vídeo ${videoId} não encontrado.`);
  }
  const videoUrl = video.video_url || video.blob_url;
  if (!videoUrl) {
    throw new AnalysisInputError(
      `Vídeo ${videoId} não tem uma URL de vídeo (video_url/blob_url) salva — não dá para enviar ao Gemini.`
    );
  }

  const analysis = await queryOne<AnalysisRow>(
    `insert into analyses (video_id, status, requested_by)
     values ($1, 'pending', $2)
     returning *`,
    [videoId, requestedBy]
  );
  if (!analysis) throw new Error("Falha ao criar registro de análise.");

  // fire-and-forget
  processAnalysis(analysis.id, videoUrl).catch((err) => {
    console.error(`Erro ao processar análise ${analysis.id}:`, err);
  });

  return analysis;
}

async function processAnalysis(analysisId: string, videoUrl: string) {
  await query(`update analyses set status = 'processing' where id = $1`, [analysisId]);

  try {
    const result = await analyzeVideoWithGemini(videoUrl);
    await query(
      `update analyses set status = 'done', summary = $2, patterns = $3, raw_response = $4, completed_at = now()
       where id = $1`,
      [analysisId, result.summary, result.patterns, JSON.stringify(result.raw)]
    );
  } catch (err) {
    const message =
      err instanceof GeminiConfigError || err instanceof GeminiRequestError
        ? err.message
        : `Erro inesperado ao analisar vídeo: ${(err as Error).message}`;
    await query(
      `update analyses set status = 'error', error_message = $2, completed_at = now() where id = $1`,
      [analysisId, message]
    );
  }
}
