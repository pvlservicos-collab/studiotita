/**
 * Endpoint MCP (Model Context Protocol) sobre HTTP — é aqui que o Claude
 * Code do seu cliente se conecta:
 *
 *   claude mcp add --transport http videoteca-ig https://SEU_DOMINIO/api/mcp \
 *     --header "Authorization: Bearer SEU_MCP_API_KEY" \
 *     --header "X-Client-Name: nome_do_cliente"
 *
 * Autenticação: token fixo em MCP_API_KEY (.env.local). Se MCP_API_KEY não
 * estiver definido, o endpoint fica aberto (conveniente para testar
 * localmente) — defina antes de entregar o acesso a um cliente de verdade.
 */
import { createMcpHandler } from "mcp-handler";
import { registerTools } from "@/mcp/tools";
import { MCP_INSTRUCTIONS } from "@/mcp/guide";
import { actorStorage } from "@/mcp/actor";

export const runtime = "nodejs";
// request_video_analysis roda o Gemini em background dentro deste limite.
export const maxDuration = 300;

// basePath "/api" faz o mcp-handler atender em /api/mcp (o padrão é /mcp).
// SSE fica desligado: exigiria Redis e o Claude Code usa o transporte HTTP.
const mcpHandler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  // instructions chega ao Claude na conexão: ele já sabe o que o app faz e quais tools existem.
  { serverInfo: { name: "videoteca-augusto", version: "0.2.0" }, instructions: MCP_INSTRUCTIONS },
  { basePath: "/api", maxDuration, disableSse: true }
);

function unauthorized() {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Não autorizado. Verifique o header Authorization: Bearer <MCP_API_KEY>." },
      id: null,
    }),
    { status: 401, headers: { "content-type": "application/json" } }
  );
}

function checkAuth(req: Request): boolean {
  const expected = process.env.MCP_API_KEY;
  if (!expected) return true; // sem chave configurada ainda = endpoint aberto (modo setup)
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  // ?key= na URL: conectores do app Claude (desktop/claude.ai) não mandam cabeçalho próprio.
  const queryKey = new URL(req.url).searchParams.get("key");
  return token === expected || queryKey === expected;
}

async function withActor(req: Request, run: () => Promise<Response>) {
  const actor = req.headers.get("x-client-name") || new URL(req.url).searchParams.get("client") || "cliente";
  return actorStorage.run(actor, run);
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return unauthorized();
  return withActor(req, () => mcpHandler(req));
}

export async function GET(req: Request) {
  if (!checkAuth(req)) return unauthorized();
  return withActor(req, () => mcpHandler(req));
}

export async function DELETE(req: Request) {
  if (!checkAuth(req)) return unauthorized();
  return withActor(req, () => mcpHandler(req));
}
