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
import { actorStorage } from "@/mcp/actor";

export const runtime = "nodejs";
export const maxDuration = 120;

// Nota: a assinatura exata de createMcpHandler pode variar um pouco entre
// versões do pacote `mcp-handler`. Se o `npm run build` reclamar aqui,
// confira o README do pacote instalado (node_modules/mcp-handler/README.md)
// e ajuste os argumentos — a ideia (registrar as tools num McpServer e
// expor um handler compatível com Route Handlers do Next.js) permanece a
// mesma.
const mcpHandler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  { name: "videoteca-ig", version: "0.1.0" }
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
  return token === expected;
}

async function withActor(req: Request, run: () => Promise<Response>) {
  const actor = req.headers.get("x-client-name") || "cliente";
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
