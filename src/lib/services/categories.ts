/**
 * Curadoria por categoria: as categorias vêm da análise mais recente de cada
 * vídeo (geradas pelo Gemini). As do Augusto aparecem pelo nome ("Política");
 * as de concorrentes e hashtags levam a origem na frente ("@eslen+Política",
 * "#tempo+Política"), para nunca misturar vídeos de contas diferentes.
 * Cada vídeo pode ser desligado da seleção de uma categoria; só os ligados
 * entram em copiar, baixar e gerar roteiro.
 */
import { query } from "@/lib/db";
import { categoryKey } from "@/lib/categories";
import { metricsLine } from "@/lib/services/report";
import type { AnalysisRow, VideoRow } from "@/lib/types";

export class CategoryInputError extends Error {}

export interface CategoryVideo {
  video: VideoRow;
  enabled: boolean;
  analysis: Pick<AnalysisRow, "id" | "summary" | "transcript" | "structure" | "hook" | "categories" | "model">;
}

export interface CategoryGroup {
  key: string;
  name: string;
  origin: "own" | "competitor" | "hashtag";
  owner: string | null;
  videos: CategoryVideo[];
  enabled_count: number;
}

/** Prefixo da categoria pela origem do vídeo. */
export function originPrefix(v: Pick<VideoRow, "source" | "competitor_username" | "hashtag">) {
  if (v.source === "competitor") return `@${v.competitor_username ?? "concorrente"}+`;
  if (v.source === "hashtag") return `#${v.hashtag}+`;
  return "";
}

export async function listCategories(): Promise<CategoryGroup[]> {
  const rows = await query<VideoRow & { a_id: string; a_summary: string; a_transcript: string; a_structure: string; a_hook: string; a_categories: string[]; a_model: string }>(
    `select v.*, c.username as competitor_username,
            la.id as a_id, la.summary as a_summary, la.transcript as a_transcript, la.structure as a_structure,
            la.hook as a_hook, la.categories as a_categories, la.model as a_model
     from videos v
     left join competitors c on c.id = v.competitor_id
     join lateral (
       select * from analyses a where a.video_id = v.id and a.status = 'done'
       order by a.requested_at desc limit 1
     ) la on true
     where coalesce(array_length(la.categories, 1), 0) > 0`
  );
  const selection = await query<{ category: string; video_id: string; enabled: boolean }>(`select * from category_selection`);
  const disabled = new Set(selection.filter((s) => !s.enabled).map((s) => `${s.category}|${s.video_id}`));

  const groups = new Map<string, { names: Map<string, number>; videos: CategoryVideo[]; origin: CategoryGroup["origin"]; owner: string | null }>();
  for (const r of rows) {
    const { a_id, a_summary, a_transcript, a_structure, a_hook, a_categories, a_model, ...video } = r;
    const prefix = originPrefix(video);
    const origin: CategoryGroup["origin"] = video.source === "competitor" ? "competitor" : video.source === "hashtag" ? "hashtag" : "own";
    for (const raw of a_categories) {
      const name = `${prefix}${raw}`;
      const key = categoryKey(name);
      if (!key) continue;
      const g = groups.get(key) ?? { names: new Map<string, number>(), videos: [] as CategoryVideo[], origin, owner: prefix ? prefix.slice(0, -1) : null };
      g.names.set(name, (g.names.get(name) ?? 0) + 1);
      g.videos.push({
        // vem de uma análise concluída: o card mostra "Ver análise" e as categorias
        video: { ...video, raw_meta: undefined, latest_analysis_id: a_id, latest_analysis_status: "done", latest_analysis_categories: a_categories } as VideoRow,
        enabled: !disabled.has(`${key}|${video.id}`),
        analysis: { id: a_id, summary: a_summary, transcript: a_transcript, structure: a_structure, hook: a_hook, categories: a_categories, model: a_model },
      });
      groups.set(key, g);
    }
  }

  return Array.from(groups.entries())
    .map(([key, g]) => {
      // nome exibido = a grafia mais usada
      const name = Array.from(g.names.entries()).sort((a, b) => b[1] - a[1])[0][0];
      const videos = g.videos.sort((a, b) => (b.video.views ?? 0) - (a.video.views ?? 0));
      return { key, name, origin: g.origin, owner: g.owner, videos, enabled_count: videos.filter((v) => v.enabled).length };
    })
    .sort((a, b) => b.videos.length - a.videos.length || a.name.localeCompare(b.name, "pt-BR"));
}

export async function getCategory(nameOrKey: string) {
  const key = categoryKey(nameOrKey);
  const group = (await listCategories()).find((g) => g.key === key);
  if (!group) throw new CategoryInputError(`Categoria "${nameOrKey}" não encontrada. Veja as existentes com list_categories.`);
  return group;
}

export async function setCategorySelection(category: string, videoId: string, enabled: boolean) {
  await query(
    `insert into category_selection (category, video_id, enabled, updated_at) values ($1, $2, $3, now())
     on conflict (category, video_id) do update set enabled = excluded.enabled, updated_at = now()`,
    [categoryKey(category), videoId, enabled]
  );
}

export function originLabel(v: VideoRow) {
  if (v.source === "competitor") return `@${v.competitor_username ?? "concorrente"} (concorrente)`;
  if (v.source === "hashtag") return `#${v.hashtag} (hashtag)`;
  return "@augustotita";
}

/** Um vídeo de referência em Markdown: métricas + o que o Gemini extraiu. */
export function referenceMarkdown(v: VideoRow, a: Pick<AnalysisRow, "hook" | "structure" | "transcript">, index: number, maxTranscript = 4000) {
  const transcript = a.transcript && a.transcript.length > maxTranscript ? `${a.transcript.slice(0, maxTranscript)}…` : a.transcript;
  return [
    `## ${index}. ${(v.caption ?? "Sem legenda").split("\n")[0].slice(0, 90)}`,
    `${originLabel(v)}${v.posted_at ? ` · ${new Date(v.posted_at).toLocaleDateString("pt-BR")}` : ""}${v.permalink ? ` · ${v.permalink}` : ""}`,
    `**Métricas:** ${metricsLine(v) || "sem métricas"}`,
    a.hook ? `**Gancho identificado pelo Gemini:**\n${a.hook}` : "",
    a.structure ? `**Estrutura gerada pelo Gemini:**\n${a.structure}` : "",
    transcript ? `**Roteiro (transcrição do Gemini):**\n${transcript}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Roteiros (transcrição + gancho + estrutura) dos vídeos ligados da categoria, em Markdown. */
export async function compileCategoryScripts(category: string) {
  const group = await getCategory(category);
  const selected = group.videos.filter((v) => v.enabled);
  const parts = selected.map(({ video, analysis }, i) => referenceMarkdown(video, analysis, i + 1, 100000));
  const markdown = `# Roteiros da categoria: ${group.name}\n\n${selected.length} de ${group.videos.length} vídeos selecionados\n\n${parts.join("\n\n---\n\n")}`;
  return { category: group.name, selected: selected.length, total: group.videos.length, markdown, videoIds: selected.map((v) => v.video.id) };
}
