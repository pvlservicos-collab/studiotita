/**
 * Gerador de roteiros ("Criar roteiro" no menu, categorias e Claude via MCP).
 * Monta um pedido de texto ao Gemini com: método e estrutura do Augusto (da
 * Biblioteca) + vídeos de referência escolhidos (melhores, categorias,
 * concorrentes) + trechos das aulas + assunto e instruções + cenas do
 * Estúdio Reels (opcional). O roteiro gerado é salvo em Roteiros.
 */
import { query, queryOne } from "@/lib/db";
import { generateJsonWithGemini } from "@/lib/gemini";
import { categoryKey } from "@/lib/categories";
import { selectBest, periodRange, rankValue, RANK_METRICS, type PeriodId, type RankMetric } from "@/lib/periods";
import { ESTUDIO_REELS_FILE, ESTUDIO_REELS_GUIDE, SCENES_INSTRUCTION } from "@/lib/estudioReels";
import { listVideos } from "@/lib/services/videos";
import { latestDoneAnalyses } from "@/lib/services/report";
import { listCategories, referenceMarkdown, CategoryInputError } from "@/lib/services/categories";
import { searchLibrary } from "@/lib/services/files";
import { createScript } from "@/lib/services/scripts";
import type { ScriptRow, VideoRow } from "@/lib/types";

export interface GenerateOptions {
  /** gera a partir de uma seleção aleatória do conteúdo do Augusto */
  random?: boolean;
  best?: { period: PeriodId; metric: RankMetric; top: number } | null;
  /** categorias do Augusto e de concorrentes ("@usuario+Categoria"), pelo nome */
  categories?: string[];
  /** concorrentes: os vídeos mais vistos de cada um entram como referência */
  competitorIds?: string[];
  subject?: string | null;
  /** busca por palavra nos vídeos já analisados (legenda, transcrição e categorias) */
  videoSearch?: { term: string; metric?: RankMetric; top?: number } | null;
  /** termo para puxar trechos das aulas da Biblioteca */
  librarySearch?: string | null;
  instructions?: string | null;
  scenes?: boolean;
  /** substitui o bloco de instruções padrão (método + estrutura); as referências são anexadas sempre */
  instructionsOverride?: string | null;
  maxReferences?: number;
}

export class GeneratorInputError extends Error {}

const METHOD_FILE = "prompt-roteiros-ascensao-tita.md";
const STRUCTURE_FILE = "estrutura-roteiro-reel.md";

export async function libraryText(name: string) {
  const row = await queryOne<{ text_content: string | null }>(
    `select text_content from files where name = $1 order by created_at desc limit 1`,
    [name]
  );
  return row?.text_content ?? null;
}

/** Instruções padrão: método + estrutura do Augusto (editáveis antes de enviar). */
export async function defaultInstructions(topic?: string | null) {
  const [method, structure] = await Promise.all([libraryText(METHOD_FILE), libraryText(STRUCTURE_FILE)]);
  return [
    `Escreva um roteiro NOVO de reel para o Augusto Weber${topic ? ` sobre: ${topic}` : ""}.`,
    `Use os vídeos de referência (no fim deste pedido) para entender o que funcionou: os ganchos, o arco da narrativa, os gatilhos e os números de desempenho. Aprenda o padrão, mas não copie frases; o roteiro novo precisa ter um tema próprio.`,
    method
      ? `\n=== MÉTODO DE ROTEIRO DO AUGUSTO (arquivo "${METHOD_FILE}" da Biblioteca) ===\n${method}`
      : "\nSiga o método do Augusto: gancho de até 3s, CTA de salvar, corpo com 2 ou 3 blocos de conteúdo notável, alerta ou solução, CTA de compartilhar, apresentação e CTA final. Máximo 300 palavras.",
    structure ? `\n=== ESTRUTURA A SEGUIR (arquivo "${STRUCTURE_FILE}" da Biblioteca) ===\n${structure}` : "",
  ].join("\n");
}

/** Mantido para a aba Categorias: instruções padrão de uma categoria. */
export async function defaultGenerationInstructions(category: string) {
  return defaultInstructions(`a categoria "${category}"`);
}

type Reference = { video: VideoRow; analysis: { hook: string | null; structure: string | null; transcript: string | null } };

async function collectReferences(opts: GenerateOptions) {
  const refs = new Map<string, Reference & { reason: string }>();
  const labels: string[] = [];

  // melhores posts do Augusto no período
  if (opts.best) {
    const own = await listVideos({ scope: "own" });
    const analyses = await latestDoneAnalyses(own.map((v) => v.id));
    const withAnalysis = own.filter((v) => analyses.has(v.id));
    const best = selectBest(withAnalysis, opts.best.period, opts.best.metric, opts.best.top).videos;
    for (const v of best) refs.set(v.id, { video: v, analysis: analyses.get(v.id)!, reason: "melhores posts" });
    labels.push(`Melhores (${periodRange(opts.best.period).label}, por ${RANK_METRICS.find((m) => m.id === opts.best!.metric)?.label.toLowerCase()})`);
  }

  // categorias (do Augusto ou de concorrentes), só os vídeos ligados
  if (opts.categories?.length) {
    const groups = await listCategories();
    for (const name of opts.categories) {
      const g = groups.find((x) => x.key === categoryKey(name));
      if (!g) throw new CategoryInputError(`Categoria "${name}" não encontrada.`);
      for (const cv of g.videos.filter((x) => x.enabled)) refs.set(cv.video.id, { video: cv.video, analysis: cv.analysis, reason: g.name });
      labels.push(g.name);
    }
  }

  // vídeos que falam de um assunto (busca na legenda, transcrição e categorias)
  if (opts.videoSearch?.term?.trim()) {
    const found = await listVideos({ scope: "all", search: opts.videoSearch.term.trim() });
    const analyses = await latestDoneAnalyses(found.map((v) => v.id));
    const withAnalysis = found.filter((v) => analyses.has(v.id));
    const metric = opts.videoSearch.metric ?? "views";
    const top = withAnalysis.sort((a, b) => rankValue(b, metric) - rankValue(a, metric)).slice(0, opts.videoSearch.top ?? 5);
    if (!top.length) throw new GeneratorInputError(`Nenhum vídeo analisado fala sobre "${opts.videoSearch.term}". Analise vídeos com o Gemini ou tente outra palavra.`);
    for (const v of top) refs.set(v.id, { video: v, analysis: analyses.get(v.id)!, reason: "busca" });
    labels.push(`“${opts.videoSearch.term}”`);
  }

  // concorrentes: os mais vistos que já têm análise
  for (const id of opts.competitorIds ?? []) {
    const vids = await listVideos({ scope: "competitor", competitorId: id });
    const analyses = await latestDoneAnalyses(vids.map((v) => v.id));
    const top = vids.filter((v) => analyses.has(v.id)).sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);
    if (!top.length) throw new GeneratorInputError(`O concorrente ${vids[0]?.competitor_username ? `@${vids[0].competitor_username}` : id} ainda não tem vídeos analisados pelo Gemini.`);
    for (const v of top) refs.set(v.id, { video: v, analysis: analyses.get(v.id)!, reason: "concorrente" });
    labels.push(`@${top[0].competitor_username}`);
  }

  // limita o tamanho do pedido: fica com os de mais views
  const max = opts.maxReferences ?? 10;
  const list = Array.from(refs.values()).sort((a, b) => (b.video.views ?? 0) - (a.video.views ?? 0)).slice(0, max);
  return { list, labels };
}

async function libraryPassages(term: string) {
  const hits = await searchLibrary(term, 6);
  if (!hits.length) return "";
  const rows = await query<{ id: string; title: string; content: string; file_name: string }>(
    `select s.id, s.title, s.content, f.name as file_name from file_sections s join files f on f.id = s.file_id where s.id = any($1::uuid[])`,
    [hits.map((h) => h.section_id)]
  );
  return rows.map((r) => `### ${r.title} (${r.file_name})\n${r.content.slice(0, 1800)}`).join("\n\n");
}

/** Seleção aleatória: uma categoria do Augusto (ou os melhores do trimestre) + um trecho de aula sorteado. */
async function randomOptions(base: GenerateOptions): Promise<GenerateOptions> {
  const own = (await listCategories()).filter((g) => g.origin === "own" && g.enabled_count > 0);
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const passage = await queryOne<{ title: string }>(
    `select s.title from file_sections s join files f on f.id = s.file_id
     where f.category = 'transcricao_aula' and s.level = 2 and s.char_count > 400
     order by random() limit 1`
  );
  return {
    ...base,
    categories: own.length ? [pick(own).name] : [],
    best: own.length ? null : { period: "quarter", metric: pick(["views", "saves", "shares"] as RankMetric[]), top: 5 },
    librarySearch: passage ? passage.title.replace(/[“”"…]/g, "").replace(/\s+—\s+S\d+.*$/, "").slice(0, 40) : null,
    subject: base.subject ?? (passage ? `um tema inspirado no trecho de aula "${passage.title}"` : null),
  };
}

const SCRIPT_SCHEMA = (scenes: boolean) => ({
  type: "OBJECT",
  properties: {
    titulo: { type: "STRING" },
    gancho: { type: "STRING" },
    estrutura: { type: "STRING" },
    roteiro_completo: { type: "STRING" },
    observacoes: { type: "STRING" },
    ...(scenes ? { cenas: { type: "STRING" } } : {}),
  },
  required: ["titulo", "gancho", "estrutura", "roteiro_completo", "observacoes", ...(scenes ? ["cenas"] : [])],
});

/** Monta o pedido completo (sem chamar o Gemini). Útil para mostrar antes de enviar. */
export async function buildGenerationPrompt(input: GenerateOptions) {
  const opts = input.random ? await randomOptions(input) : input;
  const { list, labels } = await collectReferences(opts);
  const passages = opts.librarySearch?.trim() ? await libraryPassages(opts.librarySearch.trim()) : "";
  if (!list.length && !passages && !opts.subject?.trim() && !opts.videoSearch?.term?.trim() && !opts.instructions?.trim() && !opts.instructionsOverride?.trim()) {
    throw new GeneratorInputError("Escolha ao menos uma fonte: melhores vídeos, categorias, concorrentes, um assunto ou trechos das aulas.");
  }

  const parts = [opts.instructionsOverride?.trim() || (await defaultInstructions(opts.subject))];
  if (opts.subject?.trim() && opts.instructionsOverride) parts.push(`\nAssunto do roteiro: ${opts.subject.trim()}`);
  if (opts.instructions?.trim()) parts.push(`\n=== INSTRUÇÕES EXTRAS ===\n${opts.instructions.trim()}`);
  if (opts.scenes) {
    const guide = (await libraryText(ESTUDIO_REELS_FILE)) ?? ESTUDIO_REELS_GUIDE;
    parts.push(`\n=== ESTÚDIO REELS (as cenas que o Augusto consegue montar) ===\n${guide}\n\n${SCENES_INSTRUCTION}`);
  }
  parts.push(
    `\nResponda preenchendo os campos: "titulo" (curto), "gancho" (verbal, textual e visual), "estrutura" (as partes com os segundos e o gatilho/emoção de cada uma), "roteiro_completo" (o roteiro inteiro, pronto para gravar, com as marcações de tempo) e "observacoes" (contagem de palavras, 2 ganchos alternativos, sugestão de headline e qualquer ponto a [CONFERIR]).`
  );
  if (passages) {
    parts.push(`\n=== TRECHOS DAS AULAS DO AUGUSTO (use as ideias com fidelidade; nunca invente falas nem cite o que não está aqui) ===\n${passages}`);
  }
  if (list.length) {
    parts.push(`\n=== VÍDEOS DE REFERÊNCIA (${labels.join(" · ")}) ===\n\n${list.map((r, i) => referenceMarkdown(r.video, r.analysis, i + 1)).join("\n\n---\n\n")}`);
  }

  const label = opts.random ? `Aleatório · ${labels.join(", ") || "aulas"}` : labels.join(", ") || (opts.subject?.trim() ?? "Assunto livre");
  return { prompt: parts.join("\n"), referenceIds: list.map((r) => r.video.id), label, options: opts };
}

export async function generateScript(input: GenerateOptions, createdBy = "pedro"): Promise<ScriptRow> {
  const { prompt, referenceIds, label, options } = await buildGenerationPrompt(input);
  const scenes = Boolean(options.scenes);
  const { result } = await generateJsonWithGemini<{ titulo: string; gancho: string; estrutura: string; roteiro_completo: string; observacoes: string; cenas?: string }>(
    prompt,
    SCRIPT_SCHEMA(scenes)
  );
  return createScript({
    title: result.titulo || `Roteiro · ${label}`,
    hook: result.gancho ?? "",
    structure: result.estrutura ?? "",
    full_script: `${result.roteiro_completo ?? ""}${result.observacoes ? `\n\n---\nObservações do Gemini:\n${result.observacoes}` : ""}`,
    status: "draft",
    source: "gemini",
    category: label.slice(0, 120),
    generation_prompt: prompt,
    source_video_ids: referenceIds,
    scenes: scenes ? result.cenas ?? null : null,
    generation_options: options,
    created_by: createdBy,
  });
}

/** Aba Categorias: roteiro novo a partir de uma categoria, com instruções opcionais. */
export async function generateCategoryScript(category: string, instructions?: string | null, createdBy = "pedro", scenes = false) {
  return generateScript({ categories: [category], instructionsOverride: instructions, scenes }, createdBy);
}
