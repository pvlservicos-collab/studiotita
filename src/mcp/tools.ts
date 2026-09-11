/**
 * Tools do MCP expostas para o Claude do Augusto. Acesso total por decisão
 * do dono do app: leitura, escrita, SQL livre e Graph API da Meta.
 * Quando algo falta (configuração ou dado), a mensagem de erro diz o que é e
 * onde resolver, para o Claude conseguir explicar ao usuário.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPool, query, queryOne } from "@/lib/db";
import { listVideos, getVideo, createVideo, syncVideosFromMeta } from "@/lib/services/videos";
import { listScripts, createScript, updateScript, deleteScripts } from "@/lib/services/scripts";
import { requestAnalysis, getAnalysis, getLatestAnalysis, listAnalysesForVideo, updateAnalysis } from "@/lib/services/analyses";
import {
  listFiles,
  getFile,
  createTextFile,
  updateFile,
  deleteFile,
  listSections,
  getSection,
  searchLibrary,
  FILE_CATEGORIES,
} from "@/lib/services/files";
import { listCategories, setCategorySelection, compileCategoryScripts } from "@/lib/services/categories";
import { generateCategoryScript, generateScript } from "@/lib/services/scriptGenerator";
import { listVideoScripts } from "@/lib/services/videoScripts";
import { addCompetitors, getOwnStats, listCompetitors, removeCompetitor, syncCompetitor } from "@/lib/services/competitors";
import { getHashtagQuota, listHashtagSearches, searchHashtag } from "@/lib/services/hashtags";
import { buildReport, selectPosts } from "@/lib/services/report";
import { fetchAccountMetrics, metaGraphRequest, metaIds } from "@/lib/meta";
import { DEFAULT_ANALYSIS_PROMPT } from "@/lib/gemini";
import { toApiError } from "@/lib/apiError";
import { getActor } from "@/mcp/actor";
import { MCP_INSTRUCTIONS, renderToolList } from "@/mcp/guide";
import type { AnalysisRow, VideoRow } from "@/lib/types";

function textResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  };
}

function errorResult(err: unknown) {
  const { body } = toApiError(err);
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: `Erro: ${body.error}\nCódigo: ${body.code}\n\nSe for algo que o usuário precisa resolver (ex.: uma variável de ambiente no servidor), repasse esta mensagem a ele.`,
      },
    ],
  };
}

async function logCall(actor: string, tool: string, payload: unknown, status: "ok" | "error", message?: string) {
  try {
    await query(
      `insert into integration_logs (integration, actor, tool, request_payload, status, message)
       values ('claude_code', $1, $2, $3, $4, $5)`,
      [actor, tool, JSON.stringify(payload ?? {}), status, message ?? null]
    );
  } catch {
    // Auditoria não pode derrubar a chamada principal.
  }
}

/** raw_meta é o payload bruto da Meta: grande e redundante com `metrics`. */
function slimVideo(v: VideoRow & { raw_meta?: unknown }) {
  const { raw_meta: _raw, ...rest } = v;
  return rest;
}

/** raw_response é a resposta bruta do Gemini: grande e redundante com os campos. */
function slimAnalysis(a: AnalysisRow & { raw_response?: unknown }) {
  const { raw_response: _raw, ...rest } = a;
  return rest;
}

type ToolConfig = { title: string; description: string; inputSchema: Record<string, z.ZodTypeAny> };

const scopeSchema = {
  scope: z.enum(["own", "competitor", "hashtag", "all"]).optional().describe("own = Augusto (padrão), competitor, hashtag ou all"),
  competitor_id: z.string().optional().describe("UUID do concorrente (com scope=competitor)"),
  hashtag: z.string().optional().describe("Hashtag sem # (com scope=hashtag)"),
};
const bestSchema = {
  period: z.enum(["30d", "last_month", "quarter", "semester"]).optional().describe("30d (padrão), last_month, quarter (90 dias), semester (180 dias)"),
  metric: z.enum(["views", "saves", "shares", "comments", "likes", "engagement"]).optional().describe("Métrica do ranking (padrão views)"),
  top: z.number().int().positive().optional().describe("Quantos posts (padrão: todos do período)"),
};

export function registerTools(server: McpServer) {
  // Registra a tool com log em integration_logs e erro padronizado.
  function tool<T>(name: string, config: ToolConfig, run: (args: T) => Promise<unknown>) {
    server.registerTool(name, config, (async (args: T) => {
      const actor = getActor();
      try {
        const result = await run(args);
        await logCall(actor, name, args, "ok");
        return textResult(result);
      } catch (err) {
        await logCall(actor, name, args, "error", (err as Error).message);
        return errorResult(err);
      }
    }) as any);
  }

  // ---------------------------------------------------------------- guia
  tool("get_app_guide", {
    title: "Guia do app",
    description: "Explica o que é a Videoteca do Augusto, todas as ferramentas disponíveis e mostra as contagens atuais do banco. Chame primeiro se tiver dúvida de como usar.",
    inputSchema: {},
  }, async () => {
    const counts = await queryOne(
      `select (select count(*) from videos where competitor_id is null and hashtag is null)::int as videos_augusto,
              (select count(*) from videos where competitor_id is not null)::int as videos_concorrentes,
              (select count(*) from competitors)::int as concorrentes,
              (select count(*) from analyses)::int as analyses,
              (select count(*) from analyses where rules_fit is null or rules_fit = '')::int as analyses_sem_adequacao,
              (select count(*) from scripts)::int as scripts,
              (select count(*) from files)::int as files,
              (select count(*) from file_sections)::int as file_sections,
              (select max(metrics_updated_at) from videos where competitor_id is null) as metricas_atualizadas_em`
    );
    return { guide: MCP_INSTRUCTIONS, tools: renderToolList(), counts, file_categories: FILE_CATEGORIES };
  });

  // ---------------------------------------------------- posts e métricas
  tool<{ scope?: "own" | "competitor" | "hashtag" | "all"; competitor_id?: string; hashtag?: string; search?: string; sort_by?: string; limit?: number }>("list_videos", {
    title: "Listar vídeos com métricas",
    description:
      "Lista vídeos com todas as métricas (colunas + campo metrics), status da última análise e categorias. Padrão: vídeos do Augusto. " +
      "sort_by: recent (padrão) ou qualquer métrica (views, reach, likes, comments, shares, saved, reposts, ig_reels_avg_watch_time, reels_skip_rate...).",
    inputSchema: {
      ...scopeSchema,
      search: z.string().optional().describe("Busca uma palavra na legenda, na transcrição e nas categorias"),
      sort_by: z.string().optional().describe("recent ou o nome de uma métrica"),
      limit: z.number().int().positive().optional().describe("Máximo de vídeos (padrão: todos)"),
    },
  }, async ({ scope, competitor_id, hashtag, search, sort_by, limit }) => {
    let videos = await listVideos({ scope, competitorId: competitor_id, hashtag, search });
    if (sort_by && sort_by !== "recent") {
      const value = (v: VideoRow) =>
        v.metrics?.[sort_by] ?? (v as unknown as Record<string, number>)[sort_by === "saved" ? "saves" : sort_by] ?? -1;
      videos = [...videos].sort((a, b) => value(b) - value(a));
    }
    return { total: videos.length, videos: videos.slice(0, limit ?? videos.length).map(slimVideo) };
  });

  tool<{ scope?: "own" | "competitor" | "hashtag"; competitor_id?: string; hashtag?: string; period?: "30d" | "last_month" | "quarter" | "semester"; metric?: "views" | "saves" | "shares" | "comments" | "likes" | "engagement"; top?: number }>("get_best_posts", {
    title: "Melhores posts do período",
    description: "O mesmo recorte da aba 'Melhores posts': posts publicados no período, ordenados pela métrica. Avisa se o período pode estar incompleto.",
    inputSchema: { ...scopeSchema, ...bestSchema },
  }, async ({ scope, competitor_id, hashtag, period, metric, top }) => {
    const r = await selectPosts({ scope, competitorId: competitor_id, hashtag, mode: "best", period, metric, top });
    return { label: r.label, incomplete: r.incomplete, total: r.videos.length, videos: r.videos.map(slimVideo) };
  });

  tool<{ scope?: "own" | "competitor" | "hashtag"; competitor_id?: string; hashtag?: string; mode?: "all" | "best"; period?: "30d" | "last_month" | "quarter" | "semester"; metric?: "views" | "saves" | "shares" | "comments" | "likes" | "engagement"; top?: number; include_transcripts?: boolean }>("get_posts_report", {
    title: "Relatório de posts",
    description: "Relatório em Markdown (o mesmo do botão 'Gerar relatório de todos'): tabela de métricas + resumo, gancho, estrutura, categorias e adequação de cada post. mode=all (todos) ou best (melhores do período).",
    inputSchema: {
      ...scopeSchema,
      mode: z.enum(["all", "best"]).optional(),
      ...bestSchema,
      include_transcripts: z.boolean().optional().describe("Incluir as transcrições completas (fica bem maior)"),
    },
  }, async (o) => {
    const r = await buildReport({
      scope: o.scope, competitorId: o.competitor_id, hashtag: o.hashtag, mode: o.mode, period: o.period, metric: o.metric, top: o.top,
      includeTranscripts: o.include_transcripts,
    });
    return r.markdown;
  });

  tool<{ video_id: string }>("get_video", {
    title: "Detalhar vídeo",
    description: "Um vídeo com todas as métricas e o histórico completo de análises (resumo, transcrição, estrutura, gancho, categorias, adequação, prompt e modelo).",
    inputSchema: { video_id: z.string().describe("UUID do vídeo") },
  }, async ({ video_id }) => {
    const video = await getVideo(video_id);
    if (!video) throw new Error(`Vídeo ${video_id} não encontrado. Confira o id com list_videos.`);
    const analyses = await listAnalysesForVideo(video_id);
    return { video: slimVideo(video), analyses: analyses.map(slimAnalysis) };
  });

  tool<{ limit?: number }>("sync_videos_from_meta", {
    title: "Sincronizar vídeos do Augusto",
    description: "Busca os posts mais recentes do Instagram @augustotita e cria/atualiza os vídeos com todas as métricas. Não dispara análises.",
    inputSchema: { limit: z.number().int().min(1).max(500).optional().describe("Quantos posts recentes buscar (padrão 25; semestre ≈ 200+)") },
  }, async ({ limit }) => ({ synced: await syncVideosFromMeta(limit ?? 25) }));

  tool<{ video_url: string; caption?: string; thumbnail_url?: string; permalink?: string; posted_at?: string }>("add_video", {
    title: "Cadastrar vídeo manualmente",
    description: "Cadastra um vídeo que não veio da Meta (ex.: vídeo ainda não publicado), pela URL pública do arquivo de vídeo.",
    inputSchema: {
      video_url: z.string().describe("URL pública do arquivo de vídeo (mp4)"),
      caption: z.string().optional(),
      thumbnail_url: z.string().optional(),
      permalink: z.string().optional(),
      posted_at: z.string().optional().describe("Data ISO"),
    },
  }, async (input) => ({ video: await createVideo({ ...input, source: "claude_code" }) }));

  tool<{ days?: number }>("get_account_metrics", {
    title: "Métricas da conta",
    description:
      "Métricas da conta do Instagram ao vivo da Meta, num período de 1 a 28 dias: perfil (seguidores), totais (views, alcance, contas engajadas, interações, " +
      "curtidas, comentários, compartilhamentos, salvamentos, visitas ao perfil, cliques no link), alcance por dia, alcance seguidores × não seguidores, " +
      "views/interações por formato (reels, stories, posts), seguidores ganhos e perdidos, e público (idade, gênero, cidade, país).",
    inputSchema: { days: z.number().int().min(1).max(28).optional().describe("Período em dias (padrão 28)") },
  }, async ({ days }) => ({ metrics: await fetchAccountMetrics(days ?? 28) }));

  // ------------------------------------------------------------ análises
  tool("get_default_prompt", {
    title: "Prompt padrão do Gemini",
    description: "Mostra o prompt padrão enviado ao Gemini junto com o vídeo e o modelo em uso. A lista de categorias existentes é acrescentada ao fim automaticamente.",
    inputSchema: {},
  }, async () => ({ default_prompt: DEFAULT_ANALYSIS_PROMPT, model: process.env.GEMINI_MODEL || "gemini-2.5-pro" }));

  tool<{ video_id: string; prompt?: string }>("request_video_analysis", {
    title: "Analisar vídeo com o Gemini",
    description:
      "Envia o vídeo (do Augusto, de concorrente ou de hashtag) ao Gemini. Sem prompt, usa o padrão. A resposta sempre volta em summary, transcript, " +
      "structure, hook e categories. Roda em background (~30-60s): acompanhe com get_analysis. Consome a API do Gemini: só dispare quando o usuário pedir.",
    inputSchema: {
      video_id: z.string().describe("UUID do vídeo"),
      prompt: z.string().optional().describe("Prompt personalizado (opcional)"),
    },
  }, async ({ video_id, prompt }) => {
    const analysis = await requestAnalysis(video_id, `claude_code:${getActor()}`, prompt);
    return { analysis: slimAnalysis(analysis), note: "Análise iniciada. Consulte get_analysis com o video_id em ~30s." };
  });

  tool<{ video_id?: string; analysis_id?: string }>("get_analysis", {
    title: "Ver análise",
    description:
      "Status (pending|processing|done|error) e conteúdo completo de uma análise: summary, transcript, structure, hook, categories, rules_fit (adequação às regras do Augusto), " +
      "prompt e model. Passe analysis_id, ou video_id para a mais recente do vídeo.",
    inputSchema: {
      video_id: z.string().optional().describe("UUID do vídeo (traz a análise mais recente)"),
      analysis_id: z.string().optional().describe("UUID da análise"),
    },
  }, async ({ video_id, analysis_id }) => {
    const analysis = analysis_id ? await getAnalysis(analysis_id) : video_id ? await getLatestAnalysis(video_id) : null;
    if (!analysis) {
      throw new Error(
        analysis_id || video_id
          ? "Nenhuma análise encontrada. Use request_video_analysis ou save_analysis_fields para criar."
          : "Passe video_id ou analysis_id."
      );
    }
    return { analysis: slimAnalysis(analysis) };
  });

  tool<{ analysis_id?: string; video_id?: string; summary?: string; transcript?: string; structure?: string; hook?: string; categories?: string[]; rules_fit?: string }>("save_analysis_fields", {
    title: "Preencher campos da análise",
    description:
      "Preenche ou edita os campos de uma análise: summary, transcript, structure, hook, categories e rules_fit (adequação às regras do Augusto). " +
      "Com analysis_id edita aquela análise. Só com video_id edita a mais recente do vídeo, ou cria uma nova (feita pelo Claude) se ele não tiver nenhuma. " +
      "Campos omitidos não mudam.",
    inputSchema: {
      analysis_id: z.string().optional(),
      video_id: z.string().optional(),
      summary: z.string().optional(),
      transcript: z.string().optional(),
      structure: z.string().optional(),
      hook: z.string().optional(),
      categories: z.array(z.string()).optional(),
      rules_fit: z.string().optional().describe("Adequação às regras do Augusto"),
    },
  }, async ({ analysis_id, video_id, ...fields }) => {
    let targetId = analysis_id ?? (video_id ? (await getLatestAnalysis(video_id))?.id : undefined);
    if (!targetId) {
      if (!video_id) throw new Error("Passe analysis_id ou video_id.");
      if (!(await getVideo(video_id))) throw new Error(`Vídeo ${video_id} não encontrado.`);
      const created = await queryOne<AnalysisRow>(
        `insert into analyses (video_id, status, requested_by, model, completed_at)
         values ($1, 'done', $2, 'claude (preenchido manualmente)', now())
         returning *`,
        [video_id, `claude_code:${getActor()}`]
      );
      targetId = created!.id;
    }
    const analysis = await updateAnalysis(targetId, fields);
    if (!analysis) throw new Error(`Análise ${targetId} não encontrada.`);
    return { analysis: slimAnalysis(analysis) };
  });

  // ----------------------------------------------------------- categorias
  tool("list_categories", {
    title: "Listar categorias",
    description: "Categorias geradas pelo Gemini com os vídeos de cada uma (id, legenda, origem, views, curtidas) e se estão na seleção.",
    inputSchema: {},
  }, async () => {
    const groups = await listCategories();
    return groups.map((g) => ({
      category: g.name,
      total: g.videos.length,
      selected: g.enabled_count,
      videos: g.videos.map(({ video: v, enabled }) => ({
        video_id: v.id,
        enabled,
        caption: (v.caption ?? "").split("\n")[0].slice(0, 100),
        origin: v.source === "competitor" ? `@${v.competitor_username}` : v.source === "hashtag" ? `#${v.hashtag}` : "@augustotita",
        views: v.views,
        likes: v.likes,
        saves: v.saves,
        posted_at: v.posted_at,
      })),
    }));
  });

  tool<{ category: string; video_id: string; enabled: boolean }>("set_category_video", {
    title: "Ligar/desligar vídeo da categoria",
    description: "Tira (enabled=false) ou volta (enabled=true) um vídeo da seleção da categoria. Desligados não entram nos roteiros copiados nem no roteiro novo.",
    inputSchema: { category: z.string(), video_id: z.string(), enabled: z.boolean() },
  }, async ({ category, video_id, enabled }) => {
    await setCategorySelection(category, video_id, enabled);
    return { ok: true };
  });

  tool<{ category: string }>("get_category_scripts", {
    title: "Roteiros da categoria",
    description: "Markdown com os roteiros dos vídeos ligados da categoria: métricas, gancho, estrutura e transcrição de cada um (o mesmo do botão copiar/baixar).",
    inputSchema: { category: z.string() },
  }, async ({ category }) => (await compileCategoryScripts(category)).markdown);

  tool<{ category: string; instructions?: string; scenes?: boolean }>("generate_category_script", {
    title: "Gerar roteiro novo da categoria",
    description:
      "Pede ao Gemini (texto) um roteiro novo da categoria com base nos vídeos ligados, seguindo o método e a estrutura do Augusto da biblioteca. " +
      "instructions substitui as instruções padrão (os vídeos de referência são sempre anexados). scenes=true pede também as cenas do Estúdio Reels. " +
      "Salva em Roteiros com source 'gemini'. Consome a API do Gemini.",
    inputSchema: { category: z.string(), instructions: z.string().optional(), scenes: z.boolean().optional() },
  }, async ({ category, instructions, scenes }) => ({
    script: await generateCategoryScript(category, instructions, `claude_code:${getActor()}`, Boolean(scenes)),
  }));

  tool<{
    random?: boolean;
    video_ids?: string[];
    best_period?: "30d" | "last_month" | "quarter" | "semester";
    best_metric?: "views" | "saves" | "shares" | "comments" | "likes" | "engagement";
    best_top?: number;
    categories?: string[];
    competitor_ids?: string[];
    subject?: string;
    video_search?: string;
    video_search_metric?: "views" | "saves" | "shares" | "comments" | "likes" | "engagement";
    library_search?: string;
    instructions?: string;
    scenes?: boolean;
  }>("create_script", {
    title: "Criar roteiro (gerador)",
    description:
      "O mesmo da tela 'Criar roteiro': pede ao Gemini um roteiro novo no método e na estrutura do Augusto, combinando as fontes que você escolher: " +
      "video_ids (vídeos escolhidos a dedo, o jeito mais direto), random=true (seleção aleatória do conteúdo dele), melhores vídeos (best_period + best_metric + best_top), categorias (do Augusto ou '@concorrente+Categoria'), " +
      "competitor_ids (os vídeos mais vistos e já analisados de cada concorrente), subject (assunto específico), library_search (trechos das aulas da Biblioteca), " +
      "instructions (extras) e scenes=true (ideias de cena do Estúdio Reels). Salva em Roteiros gerados, com pontuação pelas referências. Consome a API do Gemini.",
    inputSchema: {
      random: z.boolean().optional(),
      video_ids: z.array(z.string()).optional().describe("Vídeos de referência escolhidos a dedo (UUIDs de list_videos)"),
      best_period: z.enum(["30d", "last_month", "quarter", "semester"]).optional(),
      best_metric: z.enum(["views", "saves", "shares", "comments", "likes", "engagement"]).optional(),
      best_top: z.number().int().min(1).max(20).optional(),
      categories: z.array(z.string()).optional(),
      competitor_ids: z.array(z.string()).optional(),
      subject: z.string().optional(),
      video_search: z.string().optional().describe("Palavra buscada nos vídeos analisados: entram os 5 melhores que falam disso"),
      video_search_metric: z.enum(["views", "saves", "shares", "comments", "likes", "engagement"]).optional(),
      library_search: z.string().optional(),
      instructions: z.string().optional(),
      scenes: z.boolean().optional(),
    },
  }, async (o) => ({
    script: await generateScript(
      {
        random: o.random,
        videoIds: o.video_ids,
        best: o.best_period ? { period: o.best_period, metric: o.best_metric ?? "views", top: o.best_top ?? 5 } : null,
        categories: o.categories,
        competitorIds: o.competitor_ids,
        subject: o.subject,
        videoSearch: o.video_search ? { term: o.video_search, metric: o.video_search_metric ?? "views", top: 5 } : null,
        librarySearch: o.library_search,
        instructions: o.instructions,
        scenes: o.scenes,
      },
      `claude_code:${getActor()}`
    ),
  }));

  tool<{ scope?: "own" | "competitor" | "all"; competitor_id?: string; search?: string; limit?: number }>("list_video_scripts", {
    title: "Roteiros extraídos dos vídeos",
    description:
      "Os roteiros que o Gemini extraiu dos vídeos analisados (gancho, estrutura com gatilhos e emoções, transcrição, categorias), do Augusto e dos concorrentes. " +
      "É a biblioteca permanente de referência. search procura na legenda, na transcrição e nas categorias.",
    inputSchema: {
      scope: z.enum(["own", "competitor", "all"]).optional(),
      competitor_id: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    },
  }, async (o) => ({ scripts: await listVideoScripts({ scope: o.scope, competitorId: o.competitor_id, search: o.search, limit: o.limit ?? 50 }) }));

  // ------------------------------------------------------------ roteiros
  tool("list_scripts", {
    title: "Listar roteiros",
    description:
      "Roteiros gerados/salvos: título, roteiro completo, gancho, estrutura, cenas do Estúdio Reels, categoria, origem (manual, claude_code, gemini), status, " +
      "vínculo com vídeo e pontuação interna (0-100: resultado real do vídeo publicado ou média dos vídeos de referência).",
    inputSchema: {},
  }, async () => ({ scripts: await listScripts() }));

  tool<{ title?: string; full_script: string; hook: string; structure: string; video_id?: string; category?: string; status?: "draft" | "ready" | "published" | "archived" }>("save_script", {
    title: "Salvar roteiro",
    description: "Cria um roteiro: roteiro completo, gancho (primeiros 3 segundos) e estrutura narrativa. Pode ser ligado a um vídeo (video_id) e a uma categoria.",
    inputSchema: {
      title: z.string().optional().describe("Título curto do roteiro"),
      full_script: z.string().describe("Roteiro completo, por extenso"),
      hook: z.string().describe("Gancho — o que acontece nos primeiros 3 segundos"),
      structure: z.string().describe("Estrutura (partes com os segundos)"),
      video_id: z.string().optional().describe("UUID de um vídeo existente para vincular"),
      category: z.string().optional(),
      status: z.enum(["draft", "ready", "published", "archived"]).optional(),
    },
  }, async (input) => {
    if (input.video_id && !(await getVideo(input.video_id))) {
      throw new Error(`video_id ${input.video_id} não existe — confira com list_videos.`);
    }
    return {
      script: await createScript({ ...input, video_id: input.video_id ?? null, source: "claude_code", created_by: `claude_code:${getActor()}` }),
    };
  });

  tool<{ script_id: string; title?: string; full_script?: string; hook?: string; structure?: string; status?: "draft" | "ready" | "published" | "archived"; video_id?: string | null }>("update_script", {
    title: "Editar roteiro",
    description: "Edita um roteiro existente. Campos omitidos não mudam; video_id null desvincula do vídeo.",
    inputSchema: {
      script_id: z.string(),
      title: z.string().optional(),
      full_script: z.string().optional(),
      hook: z.string().optional(),
      structure: z.string().optional(),
      status: z.enum(["draft", "ready", "published", "archived"]).optional(),
      video_id: z.string().nullable().optional(),
    },
  }, async ({ script_id, ...input }) => {
    const script = await updateScript(script_id, input);
    if (!script) throw new Error(`Roteiro ${script_id} não encontrado.`);
    return { script };
  });

  tool<{ script_ids: string[] }>("delete_scripts", {
    title: "Excluir roteiros",
    description: "Exclui um ou vários roteiros pelo id. Não dá para desfazer: confirme com o usuário.",
    inputSchema: { script_ids: z.array(z.string()).min(1) },
  }, async ({ script_ids }) => ({ deleted: await deleteScripts(script_ids) }));

  // ---------------------------------------------------------- concorrência
  tool("list_competitors", {
    title: "Listar concorrentes",
    description: "Concorrentes com seguidores e médias de views/curtidas/comentários dos últimos 30 vídeos, e as médias do Augusto para comparar.",
    inputSchema: {},
  }, async () => ({ competitors: await listCompetitors(), augusto: await getOwnStats() }));

  tool<{ input: string }>("add_competitors", {
    title: "Adicionar concorrentes",
    description: "Adiciona concorrentes a partir de links do Instagram ou @usuarios (vários separados por espaço, vírgula ou linha). Só contas profissionais. Puxa os últimos 50 vídeos de cada.",
    inputSchema: { input: z.string() },
  }, async ({ input }) => ({ results: await addCompetitors(input) }));

  tool<{ competitor_id: string; limit?: number }>("sync_competitor", {
    title: "Atualizar concorrente",
    description: "Atualiza o perfil e os vídeos de um concorrente (views, curtidas, comentários).",
    inputSchema: { competitor_id: z.string(), limit: z.number().int().min(1).max(300).optional().describe("Quantos posts recentes (padrão 50)") },
  }, async ({ competitor_id, limit }) => syncCompetitor(competitor_id, limit ?? 50));

  tool<{ competitor_id: string }>("remove_competitor", {
    title: "Remover concorrente",
    description: "Remove o concorrente e todos os vídeos e análises dele. Confirme com o usuário.",
    inputSchema: { competitor_id: z.string() },
  }, async ({ competitor_id }) => ({ deleted: await removeCompetitor(competitor_id) }));

  tool<{ hashtag: string; edge?: "top_media" | "recent_media" }>("search_hashtag", {
    title: "Buscar hashtag",
    description:
      "Busca os posts de uma hashtag (top_media = em alta, recent_media = últimas 24h) e salva como vídeos de scope=hashtag. " +
      "Limite da Meta: 30 hashtags DIFERENTES a cada 7 dias; repetir uma já buscada não gasta. Confira a cota antes com list_hashtag_searches.",
    inputSchema: { hashtag: z.string(), edge: z.enum(["top_media", "recent_media"]).optional() },
  }, async ({ hashtag, edge }) => searchHashtag(hashtag, edge ?? "top_media"));

  tool("list_hashtag_searches", {
    title: "Hashtags buscadas",
    description: "Hashtags já buscadas (com quantos posts salvos) e a cota da semana.",
    inputSchema: {},
  }, async () => ({ history: await listHashtagSearches(), quota: await getHashtagQuota() }));

  // ---------------------------------------------------------- biblioteca
  tool<{ category?: string; search?: string }>("list_files", {
    title: "Listar arquivos da biblioteca",
    description:
      "Arquivos da biblioteca, sem o texto (use list_file_sections/get_file_section). search procura no nome, na descrição e no texto. " +
      "Categorias: roteiro_antigo, transcricao_aula, metodo_roteiro, briefing, referencia_cientifica, imagem, outro.",
    inputSchema: {
      category: z.string().optional(),
      search: z.string().optional().describe("Palavra ou trecho para buscar"),
    },
  }, async (opts) => ({ files: await listFiles(opts) }));

  tool<{ file_id: string }>("list_file_sections", {
    title: "Títulos de um arquivo",
    description: "Lista as seções (títulos) de um arquivo na ordem, com nível (1 = tema, 2 = passagem/subtítulo) e tamanho. Use get_file_section para ler uma.",
    inputSchema: { file_id: z.string() },
  }, async ({ file_id }) => ({ sections: await listSections(file_id) }));

  tool<{ section_id: string }>("get_file_section", {
    title: "Ler seção",
    description: "O conteúdo completo de uma seção de arquivo da biblioteca.",
    inputSchema: { section_id: z.string() },
  }, async ({ section_id }) => {
    const section = await getSection(section_id);
    if (!section) throw new Error(`Seção ${section_id} não encontrada.`);
    return { section };
  });

  tool<{ query: string; limit?: number }>("search_library", {
    title: "Buscar na biblioteca",
    description: "Procura um termo em todas as seções de todos os arquivos. Devolve arquivo, título da seção, section_id e um trecho em volta do termo.",
    inputSchema: { query: z.string(), limit: z.number().int().min(1).max(100).optional().describe("Máximo de resultados (padrão 30)") },
  }, async ({ query: term, limit }) => ({ results: await searchLibrary(term, limit ?? 30) }));

  tool<{ file_id: string; max_chars?: number; offset?: number }>("get_file", {
    title: "Ler arquivo",
    description: "Um arquivo da biblioteca com o texto extraído, em partes: max_chars (padrão 30000) a partir de offset. Para arquivos grandes prefira as seções.",
    inputSchema: {
      file_id: z.string(),
      max_chars: z.number().int().min(1000).max(200000).optional(),
      offset: z.number().int().min(0).optional(),
    },
  }, async ({ file_id, max_chars, offset }) => {
    const file = await getFile(file_id);
    if (!file) throw new Error(`Arquivo ${file_id} não encontrado.`);
    const text = file.text_content ?? "";
    const start = offset ?? 0;
    const end = start + (max_chars ?? 30000);
    return {
      file: { ...file, text_content: text.slice(start, end) },
      text_length: text.length,
      next_offset: end < text.length ? end : null,
    };
  });

  tool<{ name: string; text: string; category?: string; description?: string }>("save_text_file", {
    title: "Salvar texto na biblioteca",
    description: "Cria um arquivo de texto na biblioteca (ex.: roteiros antigos melhorados, as regras do Augusto). Ele já é dividido em títulos.",
    inputSchema: {
      name: z.string().describe("Nome do arquivo"),
      text: z.string().describe("Conteúdo (use # títulos em Markdown para organizar)"),
      category: z.string().optional().describe("roteiro_antigo | transcricao_aula | metodo_roteiro | briefing | referencia_cientifica | outro"),
      description: z.string().optional(),
    },
  }, async (input) => ({
    file: await createTextFile({ ...input, source: "claude_code", created_by: `claude_code:${getActor()}` }),
  }));

  tool<{ file_id: string; name?: string; category?: string; description?: string; text_content?: string }>("update_file", {
    title: "Editar arquivo",
    description: "Edita nome, categoria, descrição ou o texto (text_content) de um arquivo. Mudar o texto refaz os títulos. Campos omitidos não mudam.",
    inputSchema: {
      file_id: z.string(),
      name: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      text_content: z.string().optional(),
    },
  }, async ({ file_id, ...input }) => {
    const file = await updateFile(file_id, input);
    if (!file) throw new Error(`Arquivo ${file_id} não encontrado.`);
    return { file: { ...file, text_content: undefined } };
  });

  tool<{ file_id: string }>("delete_file", {
    title: "Apagar arquivo",
    description: "Apaga o arquivo da biblioteca e o original do Blob. Não dá para desfazer.",
    inputSchema: { file_id: z.string() },
  }, async ({ file_id }) => {
    if (!(await deleteFile(file_id))) throw new Error(`Arquivo ${file_id} não encontrado.`);
    return { deleted: true };
  });

  // -------------------------------------------------------- acesso total
  tool("get_db_schema", {
    title: "Esquema do banco",
    description: "Todas as tabelas e colunas do banco Postgres do app, com tipos.",
    inputSchema: {},
  }, async () => {
    const rows = await query<{ table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
      `select table_name, column_name, data_type, is_nullable, column_default
       from information_schema.columns
       where table_schema = 'public'
       order by table_name, ordinal_position`
    );
    const tables: Record<string, string[]> = {};
    for (const r of rows) {
      (tables[r.table_name] ??= []).push(
        `${r.column_name} ${r.data_type}${r.is_nullable === "NO" ? " not null" : ""}${r.column_default ? ` default ${r.column_default}` : ""}`
      );
    }
    return { tables };
  });

  tool<{ sql: string; params?: unknown[] }>("run_sql", {
    title: "Executar SQL",
    description:
      "Executa qualquer SQL no Postgres do app (select, insert, update, delete, alter, create...). Use $1, $2... com params para valores. " +
      "Sem params, aceita vários comandos separados por ';'. Veja as tabelas com get_db_schema.",
    inputSchema: {
      sql: z.string(),
      params: z.array(z.any()).optional(),
    },
  }, async ({ sql, params }) => {
    const result = await getPool().query(sql, params?.length ? params : undefined);
    const results = Array.isArray(result) ? result : [result];
    return results.map((r) => ({ command: r.command, rowCount: r.rowCount, rows: r.rows }));
  });

  tool<{ method?: "GET" | "POST" | "DELETE"; path: string; params?: Record<string, string> }>("meta_graph_api", {
    title: "Chamar a Graph API da Meta",
    description:
      "Chamada livre à Graph API com o token da Página do Augusto. Libera tudo o que as permissões do app permitem: comentários " +
      "(GET {media_id}/comments, POST {comment_id}/replies), público, stories, marcações, hashtags, business discovery, publicação " +
      "(POST {ig_user_id}/media + media_publish), anúncios. path sem a versão, ex.: '{ig_user_id}/stories'. " +
      "ATENÇÃO: POST e DELETE agem na conta real — confirme com o usuário antes.",
    inputSchema: {
      method: z.enum(["GET", "POST", "DELETE"]).optional().describe("Padrão GET"),
      path: z.string().describe("Caminho, ex.: 17841401934562233/insights"),
      params: z.record(z.string()).optional().describe("Parâmetros (fields, metric, period, message...)"),
    },
  }, async ({ method, path, params }) => ({
    ids: metaIds(),
    response: await metaGraphRequest(method ?? "GET", path, params ?? {}),
  }));
}

export { MCP_INSTRUCTIONS };
