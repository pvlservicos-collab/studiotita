import { waitUntil } from "@vercel/functions";
import { query, queryOne } from "@/lib/db";
import type { AnalysisRow, VideoRow } from "@/lib/types";
import { analyzeVideoWithGemini, GeminiConfigError, GeminiRequestError } from "@/lib/gemini";
import { fetchMediaUrl } from "@/lib/meta";
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
 * Na Vercel, waitUntil mantém a função viva depois da resposta até o
 * processamento terminar (limitado pelo maxDuration da rota que chamou).
 */
export async function requestAnalysis(
  videoId: string,
  requestedBy: string
): Promise<AnalysisRow> {
  const video = await getVideo(videoId);
  if (!video) {
    throw new AnalysisInputError(`Vídeo ${videoId} não encontrado.`);
  }
  if (!video.ig_media_id && !video.video_url && !video.blob_url) {
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

  waitUntil(
    processAnalysis(analysis.id, video).catch((err) => {
      console.error(`Erro ao processar análise ${analysis.id}:`, err);
    })
  );

  return analysis;
}

/** Vídeos da Meta ganham um link novo, porque o salvo no sync pode ter expirado. */
async function resolveVideoUrl(video: VideoRow): Promise<string> {
  if (video.blob_url) return video.blob_url;
  if (video.ig_media_id) {
    const fresh = await fetchMediaUrl(video.ig_media_id);
    if (fresh) {
      await query(`update videos set video_url = $2 where id = $1`, [video.id, fresh]);
      return fresh;
    }
  }
  if (video.video_url) return video.video_url;
  throw new AnalysisInputError(`A Meta não devolveu o link do vídeo ${video.id}.`);
}

async function processAnalysis(analysisId: string, video: VideoRow) {
  await query(`update analyses set status = 'processing' where id = $1`, [analysisId]);

  try {
    const videoUrl = await resolveVideoUrl(video);
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
