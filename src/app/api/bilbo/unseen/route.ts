import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { markAllSeen, unseenCount } from "@/lib/services/bilbo";

export const dynamic = "force-dynamic";

/** Bolinha de notificação do Bilbo no menu. */
export async function GET(_req: NextRequest) {
  try {
    return NextResponse.json({ unseen: await unseenCount() });
  } catch {
    return NextResponse.json({ unseen: 0 });
  }
}

/** Marca tudo como visto (ao abrir a aba). */
export async function POST(_req: NextRequest) {
  try {
    await markAllSeen();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
