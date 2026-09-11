/**
 * Leitura centralizada de variáveis de ambiente + helpers para reportar
 * de forma clara (para a UI e para o Claude Code do cliente via MCP)
 * o que está faltando configurar.
 */

export interface MissingConfig {
  key: string;
  usedFor: string;
}

export function checkEnv() {
  const checks: MissingConfig[] = [];

  if (!process.env.DATABASE_URL) {
    checks.push({ key: "DATABASE_URL", usedFor: "conexão com o banco (Neon)" });
  }
  if (!process.env.GEMINI_API_KEY) {
    checks.push({ key: "GEMINI_API_KEY", usedFor: "análise de vídeo com Gemini" });
  }
  if (!process.env.FACEBOOK_ACCESS_TOKEN) {
    checks.push({ key: "FACEBOOK_ACCESS_TOKEN", usedFor: "insights da Meta Graph API" });
  }
  if (!process.env.FACEBOOK_IG_USER_ID) {
    checks.push({ key: "FACEBOOK_IG_USER_ID", usedFor: "id da conta do Instagram (Meta Graph API)" });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    checks.push({ key: "BLOB_READ_WRITE_TOKEN", usedFor: "upload de cópias de vídeo no Vercel Blob (opcional)" });
  }
  if (!process.env.MCP_API_KEY) {
    checks.push({ key: "MCP_API_KEY", usedFor: "autenticar o Claude Code do cliente no servidor MCP" });
  }

  return checks;
}

export function env(key: string): string | undefined {
  return process.env[key];
}
