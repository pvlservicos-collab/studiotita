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
import {
  generateFlowForVideo,
  generateStudioFlow,
  getStudioFlow,
  linkStudioFlow,
  listStudioFlows,
  padroesText,
} from "@/lib/services/studioFlows";
import { flowToText, type StudioScene } from "@/lib/studio/scenes";
import { flowLinks, appUrl } from "@/lib/appUrl";
import {
  anexarVideoPorUrl,
  createVideoProject,
  getVideoProject,
  listVideoProjects,
} from "@/lib/services/videoProjects";
import { renderizarNoServidor } from "@/lib/services/videoRender";
import { addCompetitors, getOwnStats, listCompetitors, removeCompetitor, syncCompetitor } from "@/lib/services/competitors";
import { getHashtagQuota, listHashtagSearches, searchHashtag } from "@/lib/services/hashtags";
import { buildReport, selectPosts } from "@/lib/services/report";
import { fetchAccountMetrics, metaGraphRequest, metaIds } from "@/lib/meta";
import { DEFAULT_ANALYSIS_PROMPT } from "@/lib/gemini";
import { toApiError } from "@/lib/apiError";
import { getActor } from "@/mcp/actor";
import {
  listWatched,
  overview as bilboOverview,
  pegarRoteiro,
  savedScripts as bilboSaved,
  scan as bilboScan,
  scriptFromPost,
  setWatched,
  trending as bilboTrending,
  watchAll,
} from "@/lib/services/bilbo";
import {
  EDIT_KINDS,
  appendToEditNote,
  createEditNote,
  editBriefing,
  editLibraryIndex,
  getEditNote,
  learnCompetitorEdit,
  listEditNotes,
  saveEditPreference,
  updateEditNote,
  formatMetrics,
  setVideoFormat,
} from "@/lib/services/editLibrary";
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

  // ------------------------------------------------------------- Bilbo 🥸
  tool("bilbo_week", {
    title: "Bilbo: virais da semana dos concorrentes",
    description: "O que o Bilbo (agente que vigia os concorrentes) separou: para cada concorrente vigiado, o perfil, os 9 posts recentes e os melhores da semana com score = views ÷ mediana de views do perfil (score ≥ 2 = viralizou). Use para mostrar ao Augusto o que está performando.",
    inputSchema: {},
  }, async () => bilboOverview());

  tool("bilbo_get_script", {
    title: "Bilbo: pegar roteiro de um post",
    description: "Faz o mesmo que o botão dourado 'Pegar roteiro': salva o post em Roteiros salvos e manda o vídeo para a análise frame a frame do Gemini (~1 min). Depois leia com bilbo_saved_scripts (gancho e estrutura). Gasta API do Gemini: só quando o Augusto pedir.",
    inputSchema: { video_id: z.string().describe("UUID do post (vem em bilbo_week)") },
  }, async (a: { video_id: string }) => pegarRoteiro(a.video_id, `claude:${getActor()}`));

  tool("bilbo_saved_scripts", {
    title: "Bilbo: roteiros salvos",
    description: "Posts de concorrentes que o Augusto salvou, com o roteiro extraído (gancho e estrutura) e o status da análise.",
    inputSchema: {},
  }, async () => bilboSaved());

  tool("bilbo_scan", {
    title: "Bilbo: varrer agora",
    description: "Atualiza os posts dos concorrentes vigiados e recalcula os melhores da semana (roda sozinho todo dia).",
    inputSchema: {},
  }, async () => bilboScan());

  tool("bilbo_set_watchlist", {
    title: "Bilbo: escolher quem vigiar",
    description: "Define os concorrentes que o Bilbo vigia (precisam estar em Concorrência). all=true = vigiar todos os concorrentes cadastrados (o padrão). usernames = só esses @. Sem argumentos, só lista os atuais.",
    inputSchema: {
      all: z.boolean().optional().describe("true = vigiar todos os concorrentes da Concorrência"),
      usernames: z.array(z.string()).optional().describe("@ dos concorrentes, ex.: ['caiocarneiro','eslen.delanogare'] (substitui a lista)"),
    },
  }, async (a: { all?: boolean; usernames?: string[] }) => (a.all ? watchAll() : a.usernames ? setWatched(a.usernames) : listWatched()));

  tool("trending_this_week", {
    title: "Vídeos em alta essa semana (todos os concorrentes)",
    description:
      "Use quando o Augusto perguntar o que está em alta / viralizando / bombando essa semana. Ranking dos posts recentes de TODOS os concorrentes da Videoteca, " +
      "por vezes_o_normal (views ÷ mediana de views do próprio perfil). Cada post vem com o link do Instagram e as métricas (views, curtidas, comentários, engajamento). " +
      "Responda SEMPRE com o link do Instagram e as métricas de cada post, e ofereça gerar o roteiro do Augusto com script_from_trending(video_id). " +
      "refresh=true atualiza os perfis na Meta antes (leva 1 a 4 minutos).",
    inputSchema: {
      days: z.number().int().min(1).max(60).optional().describe("Janela em dias (padrão 7 = essa semana)"),
      limit: z.number().int().min(1).max(50).optional().describe("Quantos posts (padrão 10)"),
      username: z.string().optional().describe("Só um concorrente (@)"),
      refresh: z.boolean().optional().describe("true = varre os concorrentes na Meta antes de responder"),
    },
  }, async (a: { days?: number; limit?: number; username?: string; refresh?: boolean }) => {
    const varredura = a.refresh ? await bilboScan() : undefined;
    const result = await bilboTrending(a);
    return varredura?.ficaram_para_a_proxima ? { ...result, varredura_incompleta: varredura.ficaram_para_a_proxima } : result;
  });

  tool("script_from_trending", {
    title: "Gerar roteiro do Augusto a partir de um vídeo em alta",
    description:
      "Quando o Augusto quiser o roteiro de um vídeo em alta: extrai o roteiro do vídeo original (frame a frame, Gemini) e gera um roteiro NOVO para ele, " +
      "no método e na voz dele, mantendo o que fez o original performar. Devolve o gancho/estrutura do original + o roteiro novo completo (salvo em Roteiros). " +
      "Pode levar até ~3 minutos. Se voltar status='extraindo', chame de novo com o mesmo video_id em 1 minuto. Gasta API do Gemini: só quando ele pedir.",
    inputSchema: {
      video_id: z.string().describe("UUID do post (vem em trending_this_week ou bilbo_week)"),
      subject: z.string().optional().describe("Tema que o Augusto quer dar ao roteiro (vazio = o sistema escolhe a partir do original)"),
      instructions: z.string().optional().describe("Pedidos extras do Augusto (tom, duração, CTA...)"),
      scenes: z.boolean().optional().describe("true = inclui ideias de cena do Estúdio Reels (metadinha)"),
    },
  }, async (a: { video_id: string; subject?: string; instructions?: string; scenes?: boolean }) =>
    scriptFromPost(a.video_id, { subject: a.subject, instructions: a.instructions, scenes: a.scenes }, `claude:${getActor()}`));

  // ------------------------------------------------- biblioteca de edição
  // A memória online de COMO editar os vídeos do Titã. Ler antes de editar;
  // gravar toda preferência nova do Augusto. Ver MCP_INSTRUCTIONS.
  const by = () => `claude:${getActor()}`;

  tool("list_edit_library", {
    title: "Biblioteca de Edição: índice",
    description: "Índice da Biblioteca de Edição do Titã: formatos de vídeo, guias, regras (preferências do Augusto) e referências de concorrentes. Comece por aqui antes de qualquer edição. kind filtra; search busca no texto.",
    inputSchema: {
      kind: z.enum(EDIT_KINDS).optional().describe("formato | regra | referencia | guia"),
      search: z.string().optional().describe("Palavra a buscar em título, texto e tags"),
    },
  }, async (a: { kind?: (typeof EDIT_KINDS)[number]; search?: string }) => {
    if (!a.kind && !a.search) return editLibraryIndex();
    const notes = await listEditNotes({ kind: a.kind, search: a.search });
    return notes.map((n) => ({ slug: n.slug, kind: n.kind, title: n.title, summary: n.summary, format_slug: n.format_slug, updated_at: n.updated_at }));
  });

  tool("get_edit_briefing", {
    title: "Briefing completo de edição de um formato",
    description: "TUDO o que é preciso para editar um vídeo do Titã num formato: a ficha do formato + todas as regras que valem para ele (as do formato e as gerais) + os guias (identidade, cenário, pipeline). Chame SEMPRE antes de editar. As regras valem acima da ficha.",
    inputSchema: { format_slug: z.string().describe("Slug do formato (ex.: metadinha). Veja em list_edit_library(kind='formato').") },
  }, async (a: { format_slug: string }) => editBriefing(a.format_slug));

  tool("get_format_metrics", {
    title: "Desempenho de cada formato de edição",
    description: "Média de views, mediana, salvamentos, compartilhamentos, comentários e engajamento dos Reels do Augusto agrupados por formato de edição, com os 5 melhores vídeos de cada. Use para recomendar qual formato usar.",
    inputSchema: { format_slug: z.string().optional().describe("Um formato só (vazio = todos)") },
  }, async (a: { format_slug?: string }) => formatMetrics(a.format_slug));

  tool("set_video_format", {
    title: "Definir o formato de edição de um vídeo",
    description: "Liga um vídeo do Augusto a um formato de edição (corrige a classificação automática ou registra um vídeo novo). Entra na métrica do formato.",
    inputSchema: { video_id: z.string().describe("UUID do vídeo"), format_slug: z.string() },
  }, async (a: { video_id: string; format_slug: string }) => {
    await setVideoFormat(a.video_id, a.format_slug);
    return { ok: true };
  });

  tool("get_edit_note", {
    title: "Ler uma nota da Biblioteca de Edição",
    description: "Uma nota inteira (Markdown), com links [[...]], backlinks, regras ligadas (se for formato) e histórico de versões.",
    inputSchema: { slug: z.string().describe("Slug ou id da nota") },
  }, async (a: { slug: string }) => getEditNote(a.slug));

  tool("save_edit_preference", {
    title: "Salvar preferência de edição do Augusto",
    description: "Use SEMPRE que o Augusto pedir uma mudança de edição que deve valer daqui pra frente (\"lembre que…\", \"sempre…\", \"nunca mais…\", \"não gostei de X\", ou uma correção que ele repete). Grava como regra na biblioteca, para todo Claude seguir. Escreva a regra de forma acionável, no imperativo, com valores concretos. Antes, confira em list_edit_library(kind='regra', search=...) se já existe uma parecida — se existir, use update_edit_note nela.",
    inputSchema: {
      rule: z.string().describe("A regra, acionável. Ex.: 'Cortar os trechos em que o Augusto olha para baixo para ler o roteiro.'"),
      title: z.string().optional().describe("Título curto (padrão: começo da regra)"),
      format_slug: z.string().optional().describe("Formato ao qual se aplica. Vazio = todos os formatos."),
      original_request: z.string().optional().describe("O pedido do Augusto com as palavras dele"),
      why: z.string().optional().describe("Motivo, se ele disse"),
      tags: z.array(z.string()).optional(),
    },
  }, async (a: { rule: string; title?: string; format_slug?: string; original_request?: string; why?: string; tags?: string[] }) => {
    const note = await saveEditPreference(a, by());
    return { salvo: true, slug: note.slug, title: note.title, aviso: "Diga ao Augusto que a preferência foi salva na Biblioteca de Edição e já vale para os próximos vídeos." };
  });

  tool("create_edit_note", {
    title: "Criar nota na Biblioteca de Edição",
    description: "Cria um formato novo (ficha completa de um tipo de vídeo), um guia ou uma referência. Para preferências do Augusto use save_edit_preference. Markdown; use [[slug]] para ligar notas.",
    inputSchema: {
      kind: z.enum(EDIT_KINDS),
      title: z.string(),
      body_md: z.string().describe("Conteúdo em Markdown"),
      summary: z.string().optional().describe("Uma frase (aparece no card)"),
      tags: z.array(z.string()).optional(),
      format_slug: z.string().optional().describe("Só para regras: formato ao qual se aplica"),
      media_url: z.string().optional().describe("Vídeo/imagem de exemplo"),
      change_note: z.string().optional(),
    },
  }, async (a: any) => {
    const { change_note, ...input } = a;
    const n = await createEditNote(input, by(), change_note || "criada pelo Claude");
    return { slug: n.slug, title: n.title };
  });

  tool("update_edit_note", {
    title: "Atualizar nota da Biblioteca de Edição",
    description: "Reescreve campos de uma nota (gera uma versão nova no histórico). Use para melhorar a ficha de um formato com o que foi aprendido numa edição, ou ajustar uma regra que mudou. Para só acrescentar, prefira append_to_edit_note. Sempre explique a mudança em change_note.",
    inputSchema: {
      slug: z.string(),
      title: z.string().optional(),
      body_md: z.string().optional(),
      summary: z.string().optional(),
      tags: z.array(z.string()).optional(),
      format_slug: z.string().nullable().optional(),
      archived: z.boolean().optional().describe("true = arquivar (regra que não vale mais)"),
      change_note: z.string().describe("O que mudou e por quê"),
    },
  }, async (a: any) => {
    const { slug, change_note, ...patch } = a;
    const n = await updateEditNote(slug, patch, by(), change_note);
    return { slug: n.slug, title: n.title, updated_at: n.updated_at };
  });

  tool("append_to_edit_note", {
    title: "Acrescentar trecho a uma nota",
    description: "Acrescenta Markdown ao fim de uma nota sem mexer no resto (ex.: uma seção nova na ficha do formato, um aprendizado de uma edição aprovada).",
    inputSchema: { slug: z.string(), markdown: z.string(), change_note: z.string() },
  }, async (a: { slug: string; markdown: string; change_note: string }) => {
    const n = await appendToEditNote(a.slug, a.markdown, by(), a.change_note);
    return { slug: n.slug, updated_at: n.updated_at };
  });

  tool("learn_competitor_edit", {
    title: "Aprender a edição de um concorrente (Gemini)",
    description: "Manda um vídeo ou print de concorrente ao Gemini, que estuda SÓ A EDIÇÃO (layout, cortes, câmera, legendas, grafismos, cor, som) e devolve a ficha + um PROMPT PRONTO para editar no mesmo estilo. Fica salvo como referência na biblioteca. media_url precisa ser link direto do arquivo (mp4/jpg/png), público. Leva 1 a 3 minutos e gasta API do Gemini: só quando o usuário pedir.",
    inputSchema: {
      media_url: z.string().describe("Link direto do vídeo ou imagem"),
      competitor: z.string().optional().describe("@ do concorrente"),
      title: z.string().optional(),
      notes: z.string().optional().describe("O que o Augusto gostou nessa edição"),
    },
  }, async (a: { media_url: string; competitor?: string; title?: string; notes?: string }) => {
    const n = await learnCompetitorEdit(a, by());
    return { slug: n.slug, title: n.title, resumo: n.summary, ver: `${appUrl()}/?nota=${n.slug}`, conteudo: n.body_md };
  });

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

  tool<{ scope?: "own" | "competitor" | "hashtag"; competitor_id?: string; hashtag?: string; mode?: "all" | "best"; period?: "30d" | "last_month" | "quarter" | "semester"; metric?: "views" | "saves" | "shares" | "comments" | "likes" | "engagement"; top?: number; include_transcripts?: boolean; include_frames?: boolean }>("get_posts_report", {
    title: "Relatório de posts",
    description: "Relatório em Markdown (o mesmo do botão 'Gerar relatório de todos'): tabela de métricas + resumo, gancho, estrutura, categorias e adequação de cada post. mode=all (todos) ou best (melhores do período).",
    inputSchema: {
      ...scopeSchema,
      mode: z.enum(["all", "best"]).optional(),
      ...bestSchema,
      include_transcripts: z.boolean().optional().describe("Incluir as transcrições completas (fica bem maior)"),
      include_frames: z.boolean().optional().describe("Incluir a leitura frame a frame de cada vídeo (fica bem maior)"),
    },
  }, async (o) => {
    const r = await buildReport({
      scope: o.scope, competitorId: o.competitor_id, hashtag: o.hashtag, mode: o.mode, period: o.period, metric: o.metric, top: o.top,
      includeTranscripts: o.include_transcripts,
      includeFrames: o.include_frames,
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

  tool<{ video_id: string; prompt?: string; studio_flow?: boolean }>("request_video_analysis", {
    title: "Analisar vídeo com o Gemini",
    description:
      "Envia o vídeo (do Augusto, de concorrente ou de hashtag) ao Gemini. Sem prompt, usa o padrão. A resposta sempre volta em summary, transcript, " +
      "structure, hook e categories. Quando a análise fica pronta, o sistema também monta a metadinha do Estúdio Reels do vídeo (studio_flow=false desliga). " +
      "Roda em background (~30-60s): acompanhe com get_analysis. Consome a API do Gemini: só dispare quando o usuário pedir.",
    inputSchema: {
      video_id: z.string().describe("UUID do vídeo"),
      prompt: z.string().optional().describe("Prompt personalizado (opcional)"),
      studio_flow: z.boolean().optional().describe("Montar a metadinha do Estúdio Reels no fim (padrão: true)"),
    },
  }, async ({ video_id, prompt, studio_flow }) => {
    const analysis = await requestAnalysis(video_id, `claude_code:${getActor()}`, prompt, studio_flow !== false);
    return {
      analysis: slimAnalysis(analysis),
      note: "Análise iniciada. Consulte get_analysis com o video_id em ~30s; a metadinha aparece em list_studio_flows logo depois.",
    };
  });

  tool<{ scope?: "own" | "competitor" | "hashtag" | "all"; competitor_id?: string; hashtag?: string; limit?: number; include_outdated?: boolean; studio_flow?: boolean }>("analyze_missing_videos", {
    title: "Analisar os vídeos que faltam",
    description:
      "Dispara a análise do Gemini nos vídeos que ainda NÃO têm análise (os já analisados ficam de fora), até o limite pedido. " +
      "Com include_outdated=true, entram também os analisados antes do frame a frame existir (latest_analysis_has_frames = false). " +
      "Cada vídeo leva de 30 a 60 segundos e consome a API do Gemini: confirme com o usuário antes e prefira lotes de até 5. " +
      "Devolve quantos começaram e quantos ainda faltam; acompanhe com get_analysis e chame de novo para continuar.",
    inputSchema: {
      ...scopeSchema,
      limit: z.number().int().min(1).max(10).optional().describe("Quantos disparar agora (padrão 5)"),
      include_outdated: z.boolean().optional().describe("Incluir análises antigas, sem o frame a frame"),
      studio_flow: z.boolean().optional().describe("Montar a metadinha do Estúdio Reels de cada um (padrão: true)"),
    },
  }, async ({ scope, competitor_id, hashtag, limit, include_outdated, studio_flow }) => {
    const videos = await listVideos({ scope, competitorId: competitor_id, hashtag });
    const pendentes = videos.filter(
      (v) =>
        v.media_type !== "IMAGE" &&
        v.media_type !== "CAROUSEL_ALBUM" &&
        v.latest_analysis_status !== "pending" &&
        v.latest_analysis_status !== "processing" &&
        (v.latest_analysis_status !== "done" || (include_outdated === true && v.latest_analysis_has_frames === false))
    );
    const lote = pendentes.slice(0, limit ?? 5);
    for (const v of lote) await requestAnalysis(v.id, `claude_code:${getActor()}`, null, studio_flow !== false);
    return {
      iniciadas: lote.length,
      ainda_faltam: pendentes.length - lote.length,
      videos: lote.map((v) => ({ video_id: v.id, caption: (v.caption ?? "").split("\n")[0].slice(0, 70) })),
      nota: "Cada análise leva ~30-60s. Consulte get_analysis com o video_id; chame esta tool de novo para o próximo lote.",
    };
  });

  tool<{ video_id?: string; analysis_id?: string }>("get_analysis", {
    title: "Ver análise",
    description:
      "Status (pending|processing|done|error) e conteúdo completo de uma análise: summary, transcript, structure, hook, frames (o que aparece na tela segundo a segundo e o tom da voz), categories, rules_fit (adequação às regras do Augusto), " +
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

  tool<{ analysis_id?: string; video_id?: string; summary?: string; transcript?: string; structure?: string; hook?: string; frames?: string; categories?: string[]; rules_fit?: string }>("save_analysis_fields", {
    title: "Preencher campos da análise",
    description:
      "Preenche ou edita os campos de uma análise: summary, transcript, structure, hook, frames (leitura frame a frame), categories e rules_fit (adequação às regras do Augusto). " +
      "Com analysis_id edita aquela análise. Só com video_id edita a mais recente do vídeo, ou cria uma nova (feita pelo Claude) se ele não tiver nenhuma. " +
      "Campos omitidos não mudam.",
    inputSchema: {
      analysis_id: z.string().optional(),
      video_id: z.string().optional(),
      summary: z.string().optional(),
      transcript: z.string().optional(),
      structure: z.string().optional(),
      hook: z.string().optional(),
      frames: z.string().optional().describe("Leitura visual segundo a segundo"),
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

  // ------------------------------------------------------- vídeo (edição)
  tool("list_video_projects", {
    title: "Listar projetos de vídeo",
    description: "Os vídeos em edição na aba Vídeo: arquivo bruto, metadinha ligada, status do render e link do mp4 pronto.",
    inputSchema: {},
  }, async () => {
    const projetos = await listVideoProjects();
    return {
      total: projetos.length,
      projetos: projetos.map((p) => ({
        id: p.id,
        titulo: p.title,
        metadinha: p.flow_title,
        arquivo: p.source_name,
        duracao_s: p.duration,
        render: p.render_status,
        mp4: p.export_url,
        editor: `${appUrl()}/video`,
      })),
    };
  });

  tool<{ title?: string; flow_id?: string; video_id?: string; video_url?: string; com_legendas?: boolean }>("create_video_project", {
    title: "Criar um projeto de vídeo",
    description:
      "Abre um projeto na aba Vídeo já montado: as telas da metadinha (flow_id) entram na linha do tempo e, com video_url, o arquivo gravado é copiado para o nosso armazenamento. " +
      "com_legendas=true traz as legendas da transcrição do vídeo de referência. Depois use render_video para gerar o mp4.",
    inputSchema: {
      title: z.string().optional(),
      flow_id: z.string().optional().describe("UUID da metadinha (studio_flows)"),
      video_id: z.string().optional().describe("UUID do vídeo de referência (para as legendas)"),
      video_url: z.string().optional().describe("Link direto do arquivo gravado pelo Augusto"),
      com_legendas: z.boolean().optional(),
    },
  }, async ({ title, flow_id, video_id, video_url, com_legendas }) => {
    const projeto = await createVideoProject({
      title,
      flow_id: flow_id ?? null,
      video_id: video_id ?? null,
      com_legendas: com_legendas === true,
      created_by: `claude_code:${getActor()}`,
    });
    const comVideo = video_url ? await anexarVideoPorUrl(projeto.id, video_url) : projeto;
    return {
      projeto: {
        id: comVideo?.id,
        titulo: comVideo?.title,
        duracao_s: comVideo?.duration,
        telas: (comVideo?.project?.telas ?? []).length,
        legendas: (comVideo?.project?.legendas ?? []).length,
      },
      editor: `${appUrl()}/video`,
      nota: video_url ? "Vídeo anexado. Chame render_video para gerar o mp4." : "Anexe o arquivo com attach_video_file ou pelo editor.",
    };
  });

  tool<{ project_id: string; video_url: string; nome?: string }>("attach_video_file", {
    title: "Anexar o arquivo gravado a um projeto",
    description: "Copia o vídeo de um link direto para o nosso armazenamento e liga ao projeto (mede a duração e encaixa as telas).",
    inputSchema: {
      project_id: z.string(),
      video_url: z.string().describe("Link direto do arquivo (mp4/mov)"),
      nome: z.string().optional(),
    },
  }, async ({ project_id, video_url, nome }) => {
    const p = await anexarVideoPorUrl(project_id, video_url, nome);
    return { projeto: { id: p?.id, titulo: p?.title, arquivo: p?.source_name, duracao_s: p?.duration } };
  });

  tool<{ project_id: string }>("render_video", {
    title: "Renderizar o vídeo no servidor",
    description:
      "Monta o mp4 final no servidor (cortes, telas da metadinha, textos, legendas e música) e guarda o arquivo. " +
      "Responde na hora; acompanhe com video_status até ficar 'pronto' e então entregue o link ao usuário.",
    inputSchema: { project_id: z.string() },
  }, async ({ project_id }) => {
    const projeto = await getVideoProject(project_id);
    if (!projeto) throw new Error(`Projeto ${project_id} não encontrado.`);
    if (!projeto.project?.fonte?.url) throw new Error("Este projeto ainda não tem o vídeo gravado. Use attach_video_file primeiro.");
    await renderizarNoServidor.iniciar(project_id);
    // o render segue depois da resposta desta chamada
    void renderizarNoServidor.processar(project_id);
    return { status: "renderizando", nota: "Leva menos que a duração do vídeo. Consulte video_status em ~30s." };
  });

  tool<{ project_id: string }>("video_status", {
    title: "Status do render",
    description: "Como está o render de um projeto: na fila, renderizando (com o progresso), pronto (com o link do mp4) ou erro.",
    inputSchema: { project_id: z.string() },
  }, async ({ project_id }) => {
    const st = await renderizarNoServidor.status(project_id);
    if (!st) throw new Error(`Projeto ${project_id} não encontrado.`);
    return {
      ...st,
      progresso: `${Math.round(Number(st.render_progress ?? 0) * 100)}%`,
      mp4: st.export_url,
      nota: st.render_status === "pronto" ? "Mande o link do mp4 para o usuário." : undefined,
    };
  });

  // ------------------------------------------- Estúdio Reels (metadinhas)
  tool<{ kind?: "referencia" | "gerado"; video_id?: string; limit?: number; include_scenes?: boolean }>("list_studio_flows", {
    title: "Listar fluxos do Estúdio Reels",
    description:
      "Os fluxos de tela do Estúdio Reels (as metadinhas: o Augusto em cima, a tela do estúdio na metade de baixo). " +
      "kind='referencia' são os fluxos reais dele, ligados ao vídeo em que foram usados (é com eles que o sistema aprende); " +
      "kind='gerado' são os que o sistema montou a partir de uma análise. Com include_scenes=true vêm as cenas em texto.",
    inputSchema: {
      kind: z.enum(["referencia", "gerado"]).optional(),
      video_id: z.string().optional().describe("UUID do vídeo"),
      limit: z.number().int().positive().optional(),
      include_scenes: z.boolean().optional().describe("Trazer as cenas de cada fluxo em texto"),
    },
  }, async ({ kind, video_id, limit, include_scenes }) => {
    const flows = await listStudioFlows({ kind, videoId: video_id, limit });
    return {
      total: flows.length,
      flows: flows.map((f) => ({
        id: f.id,
        kind: f.kind,
        title: f.title,
        summary: f.summary,
        status: f.status,
        video_id: f.video_id,
        video: f.video_caption ? f.video_caption.split("\n")[0].slice(0, 70) : null,
        video_views: f.video_views,
        link_confidence: f.link_confidence,
        link_reason: f.link_reason,
        ...flowLinks(f.id),
        cenas: include_scenes ? flowToText((f.scenes as StudioScene[]) ?? []) : undefined,
      })),
    };
  });

  tool<{ flow_id: string }>("get_studio_flow", {
    title: "Ver um fluxo do Estúdio Reels",
    description:
      "O fluxo inteiro: cenas com tempo, tipo, texto da tela, agenda/gráfico/sono, fala e instrução de gravação. " +
      "Devolve também os links: 'ver' (página com a prévia das telas, para mandar ao usuário) e 'abrir_no_estudio'.",
    inputSchema: { flow_id: z.string().describe("UUID do fluxo") },
  }, async ({ flow_id }) => {
    const flow = await getStudioFlow(flow_id);
    if (!flow) throw new Error(`Fluxo ${flow_id} não encontrado.`);
    return {
      ...flow,
      project: undefined,
      cenas_em_texto: flowToText((flow.scenes as StudioScene[]) ?? []),
      ...flowLinks(flow.id),
    };
  });

  tool<{ video_id?: string; analysis_id?: string }>("generate_studio_flow", {
    title: "Montar a metadinha de um vídeo",
    description:
      "Monta (ou refaz) o esquema de telas do Estúdio Reels que combina com um vídeo já analisado, usando os padrões dos fluxos do Augusto. " +
      "Passe video_id (usa a análise mais recente) ou analysis_id. Devolve as cenas e o LINK da metadinha para mandar ao usuário. Consome a API do Gemini: só dispare quando o usuário pedir.",
    inputSchema: {
      video_id: z.string().optional().describe("UUID do vídeo"),
      analysis_id: z.string().optional().describe("UUID da análise"),
    },
  }, async ({ video_id, analysis_id }) => {
    const actor = `claude_code:${getActor()}`;
    const flow = analysis_id ? await generateStudioFlow(analysis_id, actor) : await generateFlowForVideo(String(video_id), actor);
    return {
      flow: { ...flow, project: undefined },
      cenas_em_texto: flowToText((flow.scenes as StudioScene[]) ?? []),
      ...flowLinks(flow.id),
      nota: "Mande o link \"ver\" para o usuário abrir a prévia das telas, e o \"abrir_no_estudio\" para editar no Estúdio Reels.",
    };
  });

  tool<{ flow_id: string; video_id: string | null; reason?: string }>("link_studio_flow", {
    title: "Ligar um fluxo a um vídeo",
    description:
      "Liga um fluxo do Estúdio Reels ao vídeo em que ele foi usado (ou desliga com video_id null). Serve para corrigir as ligações dos fluxos de referência.",
    inputSchema: {
      flow_id: z.string(),
      video_id: z.string().nullable().describe("UUID do vídeo, ou null para desligar"),
      reason: z.string().optional().describe("Por que este fluxo é deste vídeo"),
    },
  }, async ({ flow_id, video_id, reason }) => ({ flow: await linkStudioFlow(flow_id, video_id, reason) }));

  tool("get_studio_patterns", {
    title: "Padrões das metadinhas do Augusto",
    description:
      "O texto que ensina como o Augusto monta as telas do Estúdio Reels (tirado dos fluxos reais dele). É o que guia toda metadinha nova. " +
      'Editável na Biblioteca pelo arquivo "estudio-reels-padroes.md".',
    inputSchema: {},
  }, async () => padroesText());

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
    description: "Adiciona concorrentes a partir de links do Instagram ou @usuarios (vários separados por espaço, vírgula ou linha). Só contas profissionais. Puxa os últimos 50 vídeos de cada e já coloca o perfil na vigília do Bilbo.",
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
