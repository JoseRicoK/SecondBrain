import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { getDatabaseClient } from "@/lib/supabase";
import { getEntryByIdForUser } from "@/lib/supabase-operations";
import {
  getAnalysisJob,
  publicAnalysisJob,
  publishAnalysisJob,
} from "@/lib/diary-analysis-jobs";
export const maxDuration = 30;
async function respond(request: Request, retry: boolean) {
  const user = await getRequestUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = retry
    ? (await request.json().catch(() => null))?.entryId
    : new URL(request.url).searchParams.get("entryId");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: "Entrada no válida" }, { status: 400 });
  try {
    const entry = await getEntryByIdForUser(id, user.uid);
    if (!entry)
      return NextResponse.json(
        { error: "Entrada no encontrada" },
        { status: 404 },
      );
    if (retry) {
      const { error } = await getDatabaseClient().rpc("retry_diary_analysis", {
        p_owner: user.uid,
        p_entry_id: id,
      });
      if (error) throw new Error("Analysis retry unavailable");
    }
    const job = await getAnalysisJob(id, user.uid);
    // Recover an unpublished outbox item without making the user's saved entry disappear.
    let pendingPublication = false;
    try {
      await publishAnalysisJob(job);
    } catch {
      pendingPublication = true;
    }
    return NextResponse.json(
      {
        analysis: publicAnalysisJob(job),
        entry: job?.status === "done" ? entry : null,
        pendingPublication,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo consultar el análisis" },
      { status: 503 },
    );
  }
}
export const GET = (request: Request) => respond(request, false);
export const POST = (request: Request) => respond(request, true);
