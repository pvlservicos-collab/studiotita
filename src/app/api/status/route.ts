import { NextResponse } from "next/server";
import { checkEnv } from "@/lib/env";

export async function GET() {
  const missing = checkEnv();
  return NextResponse.json({
    ok: missing.length === 0,
    missing,
    integrations: {
      database: !missing.some((m) => m.key === "DATABASE_URL"),
      gemini: !missing.some((m) => m.key === "GEMINI_API_KEY"),
      meta: !missing.some((m) => m.key === "FACEBOOK_ACCESS_TOKEN" || m.key === "FACEBOOK_IG_USER_ID"),
      blob: !missing.some((m) => m.key === "BLOB_READ_WRITE_TOKEN"),
      mcp: !missing.some((m) => m.key === "MCP_API_KEY"),
    },
  });
}
