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
import { listScripts, createScript, updateScript } from "@/lib/services/scripts";
import { requestAnalysis, getAnalysis, getLatestAnalysis, listAnalysesForVideo, updateAnalysis } from "@/lib/services/analyses";
import { listFiles, getFile, createTextFile, updateFile, deleteFile, FILE_CATEGORIES } from "@/lib/services/files";
import { fetchAccountMetrics, metaGraphRequest, metaIds } from "@/lib/meta";
import { DEFAULT_ANALYSIS_PROMPT } from "@/lib/gemini";
import { toApiError } from "@/lib/apiError";
import { getActor } from "@/mcp/actor";
import { MCP_INSTRUCTIONS, renderToolList } from "@/mcp/guide";
import type { AnalysisRow, VideoRow } from "@/lib/types";

function textResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
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

/** raw_response é a resposta bruta do Gemini: grande e redundante com summary/transcript. */
function slimAnalysis(a: AnalysisRow & { raw_response?: unknown }) {
  const { raw_response: _raw, ...rest } = a;
  return rest;
}

type ToolConfig = { title: string; description: string; inputSchema: Record<string, z.ZodTypeAny> };

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
      `select (select count(*) from videos)::int as videos,
              (select count(*) from analyses)::int as analyses,
              (select count(*) from analyses where rules_fit is null or rules_fit = '')::int as analyses_sem_adequacao,
              (select count(*) from scripts)::int as scripts,
              (select count(*) from files)::int as files,
              (select max(metrics_updated_at) from videos) as metricas_atualizadas_em`
    );
    return { guide: MCP_INSTRUCTIONS, tools: renderToolList(), counts, file_categories: FILE_CATEGORIES };
  });

  // ---------------------------------------------------- vídeos e métricas
  tool<{ sort_by?: string; limit?: number }>("list_videos", {
    title: "Listar vídeos com métricas",
    description:
      "Lista os vídeos com todas as métricas da Meta (colunas principais + campo metrics) e o status da última análise do Gemini. " +
      "sort_by aceita: recent (padrão) ou qualquer métrica (views, reach, likes, comments, shares, saved, reposts, ig_reels_avg_watch_time, reels_skip_rate...).",
    inputSchema: {
      sort_by: z.string().optional().describe("recent ou o nome de uma métrica"),
      limit: z.number().int().positive().optional().describe("Máximo de vídeos (padrão: todos)"),
    },
  }, async ({ sort_by, limit }) => {
    let videos = await listVideos();
    if (sort_by && sort_by !== "recent") {
      const value = (v: VideoRow) =>
        v.metrics?.[sort_by] ?? (v as unknown as Record<string, number>)[sort_by === "saved" ? "saves" : sort_by] ?? -1;
      videos = [...videos].sort((a, b) => value(b) - value(a));
    }
    return { total: videos.length, videos: videos.slice(0, limit ?? videos.length).map(slimVideo) };
  });

  tool<{ video_id: string }>("get_video", {
    title: "Detalhar vídeo",
    description: "Um vídeo com todas as métricas e o histórico completo de análises (resumo, transcrição, adequação às regras, prompt e modelo usados).",
    inputSchema: { video_id: z.string().describe("UUID do vídeo") },
  }, async ({ video_id }) => {
    const video = await getVideo(video_id);
    if (!video) throw new Error(`Vídeo ${video_id} não encontrado. Confira o id com list_videos.`);
    const analyses = await listAnalysesForVideo(video_id);
    return { video: slimVideo(video), analyses: analyses.map(slimAnalysis) };
  });

  tool<{ limit?: number }>("sync_videos_from_meta", {
    title: "Sincronizar vídeos com a Meta",
    description: "Busca os posts mais recentes do Instagram @augustotita e cria/atualiza os vídeos com todas as métricas. Não dispara análises.",
    inputSchema: { limit: z.number().int().min(1).max(500).optional().describe("Quantos posts recentes buscar (padrão 25)") },
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
    description: "Mostra o prompt padrão enviado ao Gemini junto com o vídeo e o modelo em uso.",
    inputSchema: {},
  }, async () => ({ default_prompt: DEFAULT_ANALYSIS_PROMPT, model: process.env.GEMINI_MODEL || "gemini-2.5-pro" }));

  tool<{ video_id: string; prompt?: string }>("request_video_analysis", {
    title: "Analisar vídeo com o Gemini",
    description:
      "Envia o vídeo ao Gemini. Sem prompt, usa o padrão (resumo + transcrição). Com prompt, o Gemini segue o seu pedido, mas a resposta sempre volta " +
      "nos campos summary e transcript. O prompt fica gravado na análise. Roda em background (~30-60s): acompanhe com get_analysis. " +
      "Consome a API do Gemini: só dispare quando o usuário pedir.",
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
      "Status (pending|processing|done|error) e conteúdo completo de uma análise: summary, transcript, rules_fit (adequação às regras do Augusto), " +
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

  tool<{ analysis_id?: string; video_id?: string; summary?: string; transcript?: string; rules_fit?: string }>("save_analysis_fields", {
    title: "Preencher campos da análise",
    description:
      "Preenche ou edita os campos de uma análise: summary (resumo), transcript (transcrição) e rules_fit (adequação às regras do Augusto). " +
      "Com analysis_id edita aquela análise. Só com video_id edita a mais recente do vídeo, ou cria uma nova (feita pelo Claude) se ele não tiver nenhuma. " +
      "Campos omitidos não mudam.",
    inputSchema: {
      analysis_id: z.string().optional(),
      video_id: z.string().optional(),
      summary: z.string().optional(),
      transcript: z.string().optional(),
      rules_fit: z.string().optional().describe("Adequação às regras do Augusto"),
    },
  }, async ({ analysis_id, video_id, summary, transcript, rules_fit }) => {
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
    const analysis = await updateAnalysis(targetId, { summary, transcript, rules_fit });
    if (!analysis) throw new Error(`Análise ${targetId} não encontrada.`);
    return { analysis: slimAnalysis(analysis) };
  });

  // ------------------------------------------------------------ roteiros
  tool("list_scripts", {
    title: "Listar roteiros",
    description: "Roteiros salvos: título, roteiro completo, gancho, estrutura, status e vínculo com vídeo.",
    inputSchema: {},
  }, async () => ({ scripts: await listScripts() }));

  tool<{ title?: string; full_script: string; hook: string; structure: string; video_id?: string; status?: "draft" | "ready" | "published" | "archived" }>("save_script", {
    title: "Salvar roteiro",
    description: "Cria um roteiro: roteiro completo, gancho (primeiros 3 segundos) e estrutura narrativa. Pode ser ligado a um vídeo (video_id).",
    inputSchema: {
      title: z.string().optional().describe("Título curto do roteiro"),
      full_script: z.string().describe("Roteiro completo, por extenso"),
      hook: z.string().describe("Gancho — o que acontece nos primeiros 3 segundos"),
      structure: z.string().describe("Estrutura (abertura, desenvolvimento, fechamento etc.)"),
      video_id: z.string().optional().describe("UUID de um vídeo existente para vincular"),
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

  // ---------------------------------------------------------- biblioteca
  tool<{ category?: string; search?: string }>("list_files", {
    title: "Listar arquivos da biblioteca",
    description:
      "Arquivos da biblioteca (roteiros antigos, transcrições de aula...), sem o texto completo (use get_file). " +
      "search procura no nome, na descrição e no texto. Categorias: roteiro_antigo, transcricao_aula, outro.",
    inputSchema: {
      category: z.string().optional(),
      search: z.string().optional().describe("Palavra ou trecho para buscar"),
    },
  }, async (opts) => ({ files: await listFiles(opts) }));

  tool<{ file_id: string }>("get_file", {
    title: "Ler arquivo",
    description: "Um arquivo da biblioteca com o texto completo extraído (text_content) e o link do original (blob_url).",
    inputSchema: { file_id: z.string() },
  }, async ({ file_id }) => {
    const file = await getFile(file_id);
    if (!file) throw new Error(`Arquivo ${file_id} não encontrado.`);
    return { file };
  });

  tool<{ name: string; text: string; category?: string; description?: string }>("save_text_file", {
    title: "Salvar texto na biblioteca",
    description: "Cria um arquivo de texto na biblioteca (ex.: uma transcrição, um roteiro de referência, as regras do Augusto).",
    inputSchema: {
      name: z.string().describe("Nome do arquivo"),
      text: z.string().describe("Conteúdo"),
      category: z.string().optional().describe("roteiro_antigo | transcricao_aula | outro (ou outra livre)"),
      description: z.string().optional(),
    },
  }, async (input) => ({
    file: await createTextFile({ ...input, source: "claude_code", created_by: `claude_code:${getActor()}` }),
  }));

  tool<{ file_id: string; name?: string; category?: string; description?: string; text_content?: string }>("update_file", {
    title: "Editar arquivo",
    description: "Edita nome, categoria, descrição ou o texto (text_content) de um arquivo. Campos omitidos não mudam.",
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
    return { file };
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
      "(GET {media_id}/comments, POST {comment_id}/replies), público, stories, marcações, hashtags, business discovery de concorrentes, publicação " +
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
