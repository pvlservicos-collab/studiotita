import { NextResponse } from "next/server";
import { DbConfigError } from "@/lib/db";
import { GeminiConfigError, GeminiRequestError } from "@/lib/gemini";
import { MetaConfigError, MetaRequestError } from "@/lib/meta";
import { AnalysisInputError } from "@/lib/services/analyses";

/**
 * Converte erros conhecidos em respostas JSON claras: { error, code, hint }.
 * O objetivo é que tanto a UI quanto o Claude Code do cliente (via MCP)
 * saibam exatamente o que faltou e onde.
 */
export function toApiError(err: unknown): { status: number; body: any } {
  if (err instanceof DbConfigError) {
    return { status: 503, body: { error: err.message, code: "DB_CONFIG_MISSING" } };
  }
  if (err instanceof GeminiConfigError) {
    return { status: 503, body: { error: err.message, code: "GEMINI_CONFIG_MISSING" } };
  }
  if (err instanceof GeminiRequestError) {
    return { status: 502, body: { error: err.message, code: "GEMINI_REQUEST_FAILED" } };
  }
  if (err instanceof MetaConfigError) {
    return { status: 503, body: { error: err.message, code: "META_CONFIG_MISSING" } };
  }
  if (err instanceof MetaRequestError) {
    return { status: 502, body: { error: err.message, code: "META_REQUEST_FAILED" } };
  }
  if (err instanceof AnalysisInputError) {
    return { status: 400, body: { error: err.message, code: "ANALYSIS_INPUT_INVALID" } };
  }
  console.error(err);
  return {
    status: 500,
    body: { error: (err as Error)?.message || "Erro interno inesperado.", code: "UNKNOWN" },
  };
}

export function apiErrorResponse(err: unknown) {
  const { status, body } = toApiError(err);
  return NextResponse.json(body, { status });
}
