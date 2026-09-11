import { query, queryOne } from "@/lib/db";
import { buildScoreContext, scoreFromVideos } from "@/lib/services/scriptScore";
import type { ScriptRow } from "@/lib/types";

const LIST_QUERY = `
  select s.*,
         (
           select a.summary from analyses a
           where a.script_id = s.id or a.video_id = s.video_id
           order by a.requested_at desc limit 1
         ) as latest_analysis_summary
  from scripts s
  order by s.created_at desc
`;

/**
 * Roteiros com pontuação e miniaturas: ligado a um vídeo publicado → nota do
 * resultado real; gerado → nota média dos vídeos de referência.
 */
export async function listScripts(): Promise<ScriptRow[]> {
  const [rows, ctx] = await Promise.all([query<ScriptRow>(LIST_QUERY), buildScoreContext()]);
  return rows.map((s) => {
    const ids = s.video_id ? [s.video_id] : s.source_video_ids ?? [];
    const score = s.video_id ? scoreFromVideos([s.video_id], ctx, "resultado") : scoreFromVideos(ids, ctx, "referencias");
    const thumbs = ids
      .map((id) => ctx.get(id))
      .filter((v): v is NonNullable<typeof v> => Boolean(v))
      .slice(0, 4)
      .map((v) => ({ thumbnail_url: v.thumbnail_url, caption: v.caption, permalink: v.permalink }));
    return { ...s, score, thumbs };
  });
}

export async function getScript(id: string): Promise<ScriptRow | null> {
  return queryOne<ScriptRow>(`select * from scripts where id = $1`, [id]);
}

export interface UpsertScriptInput {
  video_id?: string | null;
  title?: string;
  full_script: string;
  hook: string;
  structure: string;
  status?: "draft" | "ready" | "published" | "archived";
  source?: "manual" | "claude_code" | "gemini";
  category?: string | null;
  generation_prompt?: string | null;
  source_video_ids?: string[] | null;
  scenes?: string | null;
  generation_options?: unknown;
  created_by?: string;
}

export async function createScript(input: UpsertScriptInput): Promise<ScriptRow> {
  const row = await queryOne<ScriptRow>(
    `insert into scripts (video_id, title, full_script, hook, structure, status, source, created_by, category,
                          generation_prompt, source_video_ids, scenes, generation_options)
     values ($1,$2,$3,$4,$5,coalesce($6,'draft'),coalesce($7,'manual'),$8,$9,$10,$11,$12,$13)
     returning *`,
    [
      input.video_id ?? null,
      input.title ?? "Roteiro sem título",
      input.full_script,
      input.hook,
      input.structure,
      input.status ?? null,
      input.source ?? null,
      input.created_by ?? null,
      input.category ?? null,
      input.generation_prompt ?? null,
      input.source_video_ids?.length ? input.source_video_ids : null,
      input.scenes ?? null,
      input.generation_options ? JSON.stringify(input.generation_options) : null,
    ]
  );
  if (!row) throw new Error("Falha ao criar roteiro.");
  return row;
}

/** Apaga roteiros pelo id; devolve quantos foram apagados. */
export async function deleteScripts(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const rows = await query(`delete from scripts where id = any($1::uuid[]) returning id`, [ids]);
  return rows.length;
}

export async function updateScript(
  id: string,
  input: Partial<UpsertScriptInput>
): Promise<ScriptRow | null> {
  const existing = await getScript(id);
  if (!existing) return null;

  return queryOne<ScriptRow>(
    `update scripts set
       title = $2, full_script = $3, hook = $4, structure = $5, status = $6, video_id = $7, scenes = $8
     where id = $1
     returning *`,
    [
      id,
      input.title ?? existing.title,
      input.full_script ?? existing.full_script,
      input.hook ?? existing.hook,
      input.structure ?? existing.structure,
      input.status ?? existing.status,
      input.video_id !== undefined ? input.video_id : existing.video_id,
      input.scenes !== undefined ? input.scenes : existing.scenes ?? null,
    ]
  );
}
