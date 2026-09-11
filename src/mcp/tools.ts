/**
 * Definição das tools do MCP expostas para o Claude Code do cliente.
 * Cada tool devolve texto estruturado e, quando algo falta (configuração
 * ou dado), uma mensagem clara dizendo exatamente o que é e onde
 * resolver — para o Claude Code do cliente conseguir explicar isso a ele.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { query } from "@/lib/db";
import { listVideos, getVideo } from "@/lib/services/videos";
import { listScripts, createScript } from "@/lib/services/scripts";
import { requestAnalysis, getLatestAnalysis } from "@/lib/services/analyses";
import { getLatestInsights } from "@/lib/services/insights";
import { toApiError } from "@/lib/apiError";
import { getActor } from "@/mcp/actor";

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
        text: `Erro: ${body.error}\nCódigo: ${body.code}\n\nIsso indica exatamente o que falta configurar ou qual dado está ausente — repasse essa mensagem ao usuário se for algo que ele precisa resolver (ex.: uma variável de ambiente no servidor da Videoteca IG).`,
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

export function registerTools(server: McpServer) {
  server.registerTool(
    "list_videos",
    {
      title: "Listar vídeos",
      description:
        "Lista os vídeos da biblioteca (Instagram + cadastrados manualmente), com métricas da Meta e status da última análise do Gemini.",
      inputSchema: {},
    },
    async () => {
      try {
        const videos = await listVideos();
        await logCall(getActor(), "list_videos", {}, "ok");
        return textResult({ videos });
      } catch (err) {
        await logCall(getActor(), "list_videos", {}, "error", (err as Error).message);
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "get_video",
    {
      title: "Detalhar vídeo",
      description: "Retorna os detalhes de um vídeo específico pelo id, incluindo o histórico de análises.",
      inputSchema: { video_id: z.string().describe("UUID do vídeo") },
    },
    async ({ video_id }) => {
      try {
        const video = await getVideo(video_id);
        if (!video) {
          await logCall(getActor(), "get_video", { video_id }, "error", "not_found");
          return errorResult(new Error(`Vídeo ${video_id} não encontrado.`));
        }
        await logCall(getActor(), "get_video", { video_id }, "ok");
        return textResult({ video });
      } catch (err) {
        await logCall(getActor(), "get_video", { video_id }, "error", (err as Error).message);
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "list_scripts",
    {
      title: "Listar roteiros",
      description: "Lista os roteiros salvos (roteiro completo, gancho, estrutura e vínculo com vídeo, se houver).",
      inputSchema: {},
    },
    async () => {
      try {
        const scripts = await listScripts();
        await logCall(getActor(), "list_scripts", {}, "ok");
        return textResult({ scripts });
      } catch (err) {
        await logCall(getActor(), "list_scripts", {}, "error", (err as Error).message);
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "save_script",
    {
      title: "Salvar roteiro",
      description:
        "Salva um novo roteiro na Videoteca IG: o roteiro completo, o gancho (primeiros 3 segundos) e a estrutura narrativa. " +
        "Pode opcionalmente ser vinculado a um vídeo existente (video_id).",
      inputSchema: {
        title: z.string().optional().describe("Título curto do roteiro"),
        full_script: z.string().describe("Roteiro completo, por extenso"),
        hook: z.string().describe("Gancho — o que acontece nos primeiros 3 segundos"),
        structure: z.string().describe("Estrutura do roteiro (abertura, desenvolvimento, fechamento etc.)"),
        video_id: z.string().optional().describe("UUID de um vídeo existente para vincular, se houver"),
      },
    },
    async ({ title, full_script, hook, structure, video_id }) => {
      try {
        if (video_id) {
          const video = await getVideo(video_id);
          if (!video) {
            return errorResult(
              new Error(`video_id ${video_id} não existe na Videoteca IG — confira o id com list_videos.`)
            );
          }
        }
        const script = await createScript({
          title,
          full_script,
          hook,
          structure,
          video_id: video_id ?? null,
          source: "claude_code",
          created_by: `claude_code:${getActor()}`,
        });
        await logCall(getActor(), "save_script", { title, video_id }, "ok");
        return textResult({ script });
      } catch (err) {
        await logCall(getActor(), "save_script", { title, video_id }, "error", (err as Error).message);
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "request_video_analysis",
    {
      title: "Pedir análise ao Gemini",
      description:
        "Dispara a análise do vídeo pelo Gemini (mesmo fluxo do botão 'Pedir resumo' no painel). " +
        "A análise roda em background — use get_analysis_status para acompanhar o progresso.",
      inputSchema: { video_id: z.string().describe("UUID do vídeo a analisar") },
    },
    async ({ video_id }) => {
      try {
        const analysis = await requestAnalysis(video_id, `claude_code:${getActor()}`);
        await logCall(getActor(), "request_video_analysis", { video_id }, "ok");
        return textResult({
          analysis,
          note: "Análise iniciada (status 'pending'/'processing'). Consulte get_analysis_status daqui a alguns segundos.",
        });
      } catch (err) {
        await logCall(getActor(), "request_video_analysis", { video_id }, "error", (err as Error).message);
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "get_analysis_status",
    {
      title: "Status da análise",
      description: "Consulta o status/resultado mais recente da análise do Gemini para um vídeo.",
      inputSchema: { video_id: z.string().describe("UUID do vídeo") },
    },
    async ({ video_id }) => {
      try {
        const analysis = await getLatestAnalysis(video_id);
        if (!analysis) {
          return errorResult(
            new Error(`Nenhuma análise encontrada para o vídeo ${video_id}. Use request_video_analysis primeiro.`)
          );
        }
        await logCall(getActor(), "get_analysis_status", { video_id }, "ok");
        return textResult({ analysis });
      } catch (err) {
        await logCall(getActor(), "get_analysis_status", { video_id }, "error", (err as Error).message);
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "get_meta_insights",
    {
      title: "Insights da Meta",
      description: "Retorna o snapshot mais recente dos insights da conta do Instagram (seguidores, alcance, etc).",
      inputSchema: {},
    },
    async () => {
      try {
        const insights = await getLatestInsights();
        await logCall(getActor(), "get_meta_insights", {}, "ok");
        return textResult({ insights });
      } catch (err) {
        await logCall(getActor(), "get_meta_insights", {}, "error", (err as Error).message);
        return errorResult(err);
      }
    }
  );
}
