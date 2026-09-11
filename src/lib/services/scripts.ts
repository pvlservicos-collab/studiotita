import { query, queryOne } from "@/lib/db";
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

export async function listScripts(): Promise<ScriptRow[]> {
  return query<ScriptRow>(LIST_QUERY);
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
  source?: "manual" | "claude_code";
  created_by?: string;
}

export async function createScript(input: UpsertScriptInput): Promise<ScriptRow> {
  const row = await queryOne<ScriptRow>(
    `insert into scripts (video_id, title, full_script, hook, structure, status, source, created_by)
     values ($1,$2,$3,$4,$5,coalesce($6,'draft'),coalesce($7,'manual'),$8)
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
    ]
  );
  if (!row) throw new Error("Falha ao criar roteiro.");
  return row;
}

export async function updateScript(
  id: string,
  input: Partial<UpsertScriptInput>
): Promise<ScriptRow | null> {
  const existing = await getScript(id);
  if (!existing) return null;

  return queryOne<ScriptRow>(
    `update scripts set
       title = $2, full_script = $3, hook = $4, structure = $5, status = $6, video_id = $7
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
    ]
  );
}
