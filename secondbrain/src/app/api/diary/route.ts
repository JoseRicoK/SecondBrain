import { after, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { getDatabaseClient } from "@/lib/supabase";
import { getEntryByIdForUser, saveEntry } from "@/lib/supabase-operations";
import { validDiaryAnalysisDate } from "@/lib/diary-analysis";
import {
  getAnalysisJob,
  publicAnalysisJob,
  publishAnalysisJob,
} from "@/lib/diary-analysis-jobs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || body.user_id !== user.uid)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (
    typeof body.content !== "string" ||
    body.content.length > 500000 ||
    !validDiaryAnalysisDate(body.date) ||
    (body.id !== undefined && typeof body.id !== "string")
  )
    return NextResponse.json({ error: "Entrada no válida" }, { status: 400 });
  try {
    let previous;
    if (body.id) {
      previous = await getEntryByIdForUser(body.id, user.uid);
      if (!previous)
        return NextResponse.json(
          { error: "Entrada no encontrada" },
          { status: 404 },
        );
      if (previous.date !== body.date)
        return NextResponse.json(
          { error: "Fecha incorrecta" },
          { status: 400 },
        );
    } else {
      const { data, error } = await getDatabaseClient()
        .from("diary_entries")
        .select("*")
        .eq("user_id", user.uid)
        .eq("date", body.date)
        .maybeSingle();
      if (error) throw new Error("Entry lookup unavailable");
      previous = data;
    }
    // Browser mention arrays are not allowed to overwrite a completed background analysis.
    const entry = await saveEntry({
      id: previous?.id,
      date: body.date,
      user_id: user.uid,
      content: body.content,
      mentioned_people: previous?.mentioned_people || [],
      mentioned_person_ids: previous?.mentioned_person_ids ?? null,
    });
    if (!entry) throw new Error("Save failed");
    const job = await getAnalysisJob(entry.id, user.uid);
    try {
      await publishAnalysisJob(job);
    } catch {
      after(async () => {
        try {
          await publishAnalysisJob(job);
        } catch {
          console.warn("Diary analysis publication pending");
        }
      });
    }
    return NextResponse.json(
      { entry, analysis: publicAnalysisJob(job) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo guardar la entrada" },
      { status: 500 },
    );
  }
}
