import { AmbiguousPersonError } from "@/lib/person-identity";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import {
  getPeopleByUserId,
  getEntryByIdForUser,
  saveExtractedPersonInfo,
  updateEntryMoodData,
} from "@/lib/supabase-operations";
import {
  diaryAnalysisClient,
  extractDiaryPeople,
  analyzeDiaryMood,
  validDiaryAnalysisDate,
} from "@/lib/diary-analysis";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(
      request.headers.get("authorization")?.replace("Bearer ", ""),
    );
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body || body.userId !== user.uid)
      return NextResponse.json({ error: "User mismatch" }, { status: 403 });
    const { text, entryDate, entryId } = body;
    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 50000 ||
      !validDiaryAnalysisDate(entryDate) ||
      (entryId !== undefined && typeof entryId !== "string")
    ) {
      return NextResponse.json(
        {
          error:
            "Se requiere texto (máximo 50.000 caracteres) y una fecha válida de la entrada.",
        },
        { status: 400 },
      );
    }
    if (entryId) {
      const entry = await getEntryByIdForUser(entryId, user.uid);
      if (!entry)
        return NextResponse.json(
          { error: "Entrada no encontrada" },
          { status: 404 },
        );
      if (entry.date !== entryDate)
        return NextResponse.json(
          { error: "La fecha no coincide con la entrada" },
          { status: 400 },
        );
    }
    // A failed context read must never be treated as an empty address book.
    const known = await getPeopleByUserId(user.uid);
    const openai = diaryAnalysisClient();
    const peopleExtracted = await extractDiaryPeople(
      text,
      entryDate,
      known,
      openai,
    );
    for (const person of peopleExtracted) {
      const saved = await saveExtractedPersonInfo(
        person.name,
        person.information,
        user.uid,
        entryDate,
        person.id ?? null,
      );
      if (!saved) throw new Error("Person persistence failed");
      person.id = saved.id;
      person.name = saved.name || person.name;
    }
    // mention_count is derived in PostgreSQL from distinct diary dates, never from AI attempts.
    let moodAnalysis = null;
    let warning: string | undefined;
    if (entryId) {
      try {
        const values = await analyzeDiaryMood(text, openai);
        if (!(await updateEntryMoodData(entryId, values)))
          throw new Error("Mood persistence failed");
        moodAnalysis = values;
      } catch {
        warning =
          "Las personas se han guardado, pero no se pudo actualizar el análisis emocional.";
      }
    }
    return NextResponse.json({
      peopleExtracted,
      moodAnalysis,
      warning,
      totalPeopleProcessed: peopleExtracted.length,
      date: entryDate,
      message: peopleExtracted.length
        ? `Se han revisado ${peopleExtracted.length} persona(s).`
        : "No se han encontrado personas en esta entrada.",
    });
  } catch (error) {
    if (error instanceof AmbiguousPersonError)
      return NextResponse.json({ error: error.message }, { status: 409 });
    // Never log diary text, addresses, relationship context, model output or provider headers.
    const failure = error as { code?: string; status?: number };
    console.warn("People extraction failed", {
      code: failure?.code,
      status: failure?.status,
    });
    return NextResponse.json(
      {
        error:
          "No se pudo completar el análisis de personas. Puedes reintentarlo.",
      },
      { status: 500 },
    );
  }
}
