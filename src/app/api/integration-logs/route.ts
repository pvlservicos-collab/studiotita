import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { apiErrorResponse } from "@/lib/apiError";

export async function GET() {
  try {
    const logs = await query(
      `select id, integration, actor, tool, status, message, created_at
       from integration_logs
       order by created_at desc
       limit 30`
    );
    return NextResponse.json({ logs });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
