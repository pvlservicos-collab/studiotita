/**
 * Curadoria por categoria: as categorias vêm da análise mais recente de cada
 * vídeo (geradas pelo Gemini). Cada vídeo pode ser desligado da seleção de
 * uma categoria; só os ligados entram em copiar, baixar e gerar roteiro.
 */
import { query, queryOne } from "@/lib/db";
import { categoryKey } from "@/lib/categories";
import { generateJsonWithGemini } from "@/lib/gemini";
import { metricsLine } from "@/lib/services/report";
import { createScript } from "@/lib/services/scripts";
import type { AnalysisRow, ScriptRow, VideoRow } from "@/lib/types";

export class CategoryInputError extends Error {}

export interface CategoryVideo {
  video: VideoRow;
  enabled: boolean;
  analysis: Pick<AnalysisRow, "id" | "summary" | "transcript" | "structure" | "hook" | "categories" | "model">;
}

export interface CategoryGroup {
  key: string;
  name: string;
  videos: CategoryVideo[];
  enabled_count: number;
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

  const groups = new Map<string, { names: Map<string, number>; videos: CategoryVideo[] }>();
  for (const r of rows) {
    const { a_id, a_summary, a_transcript, a_structure, a_hook, a_categories, a_model, ...video } = r;
    for (const name of a_categories) {
      const key = categoryKey(name);
      if (!key) continue;
      const g = groups.get(key) ?? { names: new Map<string, number>(), videos: [] as CategoryVideo[] };
      g.names.set(name, (g.names.get(name) ?? 0) + 1);
      g.videos.push({
        video: { ...video, raw_meta: undefined } as VideoRow,
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
      return { key, name, videos, enabled_count: videos.filter((v) => v.enabled).length };
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

function origin(v: VideoRow) {
  if (v.source === "competitor") return `@${v.competitor_username ?? "concorrente"} (concorrente)`;
  if (v.source === "hashtag") return `#${v.hashtag} (hashtag)`;
  return "@augustotita";
}

/** Roteiros (transcrição + gancho + estrutura) dos vídeos ligados da categoria, em Markdown. */
export async function compileCategoryScripts(category: string) {
  const group = await getCategory(category);
  const selected = group.videos.filter((v) => v.enabled);
  const parts = selected.map(({ video: v, analysis: a }, i) =>
    [
      `## ${i + 1}. ${(v.caption ?? "Sem legenda").split("\n")[0].slice(0, 90)}`,
      `${origin(v)}${v.posted_at ? ` · ${new Date(v.posted_at).toLocaleDateString("pt-BR")}` : ""}${v.permalink ? ` · ${v.permalink}` : ""}`,
      `**Métricas:** ${metricsLine(v) || "sem métricas"}`,
      a.hook ? `**Gancho identificado pelo Gemini:**\n${a.hook}` : "",
      a.structure ? `**Estrutura gerada pelo Gemini:**\n${a.structure}` : "",
      a.transcript ? `**Roteiro (transcrição do Gemini):**\n${a.transcript}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
  );
  const markdown = `# Roteiros da categoria: ${group.name}\n\n${selected.length} de ${group.videos.length} vídeos selecionados\n\n${parts.join("\n\n---\n\n")}`;
  return { category: group.name, selected: selected.length, total: group.videos.length, markdown };
}

// Arquivos da Biblioteca que definem o método e a estrutura do Augusto.
const METHOD_FILE = "prompt-roteiros-ascensao-tita.md";
const STRUCTURE_FILE = "estrutura-roteiro-reel.md";

async function libraryText(name: string) {
  const row = await queryOne<{ text_content: string | null }>(
    `select text_content from files where name = $1 order by created_at desc limit 1`,
    [name]
  );
  return row?.text_content ?? null;
}

/** Instruções padrão do pedido de roteiro novo (editáveis no painel antes de enviar). */
export async function defaultGenerationInstructions(category: string) {
  const [method, structure] = await Promise.all([libraryText(METHOD_FILE), libraryText(STRUCTURE_FILE)]);
  return [
    `Escreva um roteiro NOVO de reel para o Augusto Weber sobre a categoria "${category}".`,
    `Use os vídeos de referência (no fim deste pedido) para entender o que funcionou nessa categoria: os ganchos, a estrutura e os números de desempenho. Aprenda o padrão, mas não copie frases; o tema do roteiro novo precisa ser diferente dos vídeos de referência.`,
    method
      ? `\n=== MÉTODO DE ROTEIRO DO AUGUSTO (arquivo "${METHOD_FILE}" da Biblioteca) ===\n${method}`
      : "\nSiga o método do Augusto: gancho de até 3s, CTA de salvar, corpo com 2 ou 3 blocos de conteúdo notável, alerta ou solução, CTA de compartilhar, apresentação e CTA final. Máximo 300 palavras.",
    structure ? `\n=== ESTRUTURA A SEGUIR (arquivo "${STRUCTURE_FILE}" da Biblioteca) ===\n${structure}` : "",
    `\nResponda preenchendo os campos: "titulo" (curto), "gancho" (gancho verbal, textual e visual), "estrutura" (as partes com os segundos de cada uma), "roteiro_completo" (o roteiro inteiro, pronto para gravar, com as marcações de tempo) e "observacoes" (contagem de palavras, 2 ganchos alternativos, sugestão de headline e qualquer ponto a [CONFERIR]).`,
  ].join("\n");
}

const SCRIPT_SCHEMA = {
  type: "OBJECT",
  properties: {
    titulo: { type: "STRING" },
    gancho: { type: "STRING" },
    estrutura: { type: "STRING" },
    roteiro_completo: { type: "STRING" },
    observacoes: { type: "STRING" },
  },
  required: ["titulo", "gancho", "estrutura", "roteiro_completo", "observacoes"],
};

/**
 * Pede ao Gemini (só texto) um roteiro novo da categoria, mandando as
 * instruções + os roteiros dos vídeos ligados. Salva em Roteiros.
 */
export async function generateCategoryScript(category: string, instructions?: string | null, createdBy = "pedro"): Promise<ScriptRow> {
  const compiled = await compileCategoryScripts(category);
  if (!compiled.selected) throw new CategoryInputError("Nenhum vídeo ligado nesta categoria: ligue ao menos um para servir de referência.");
  const prompt = `${instructions?.trim() || (await defaultGenerationInstructions(compiled.category))}\n\n=== VÍDEOS DE REFERÊNCIA DA CATEGORIA "${compiled.category}" ===\n\n${compiled.markdown}`;

  const { result } = await generateJsonWithGemini<{ titulo: string; gancho: string; estrutura: string; roteiro_completo: string; observacoes: string }>(
    prompt,
    SCRIPT_SCHEMA
  );
  return createScript({
    title: result.titulo || `Roteiro · ${compiled.category}`,
    hook: result.gancho ?? "",
    structure: result.estrutura ?? "",
    full_script: `${result.roteiro_completo ?? ""}${result.observacoes ? `\n\n---\nObservações do Gemini:\n${result.observacoes}` : ""}`,
    status: "draft",
    source: "gemini",
    category: compiled.category,
    generation_prompt: prompt,
    created_by: createdBy,
  });
}
