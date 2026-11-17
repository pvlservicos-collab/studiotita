import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { listWatched, setWatched } from "@/lib/services/bilbo";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    return NextResponse.json({ watched: await listWatched() });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** Troca quem o Bilbo vigia: { usernames: ["caiocarneiro", ...] } (até 3). */
export async function PUT(req: NextRequest) {
  try {
    const { usernames } = await req.json();
    return NextResponse.json({ watched: await setWatched(usernames ?? []) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
