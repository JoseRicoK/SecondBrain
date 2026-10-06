import { randomUUID } from "node:crypto";
import { send } from "@vercel/queue";
import { getDatabaseClient } from "./supabase";
import { readAnalysisPeople } from "./diary-reanalysis";
import { analyzeDiaryMood, extractDiaryPeople } from "./diary-analysis";
import { AmbiguousPersonError } from "./person-identity";
import { mergePersonInformation } from "./person-information";

export type AnalysisJob = {
  id: string;
  entry_id: string;
  user_id: string;
  generation: string;
  status: "queued" | "processing" | "done" | "failed" | "skipped";
  attempts: number;
  published_generation: string | null;
  error_code: string | null;
  updated_at: string;
};
export const analysisError = (code: string | null) =>
  code === "ambiguous"
    ? "Hay una persona que no se puede identificar con seguridad. Aclara su relación en el texto y vuelve a guardar."
    : code === "too_long"
      ? "El análisis admite hasta 50.000 caracteres. Tu entrada se ha guardado."
      : "Tu entrada está guardada. No se pudo completar el análisis; puedes reintentarlo con Analizar con IA.";

export async function getAnalysisJob(entryId: string, owner: string) {
  const { data, error } = await getDatabaseClient()
    .from("diary_analysis_jobs")
    .select("*")
    .eq("entry_id", entryId)
    .eq("user_id", owner)
    .maybeSingle();
  if (error) throw new Error("Analysis state unavailable");
  return data as AnalysisJob | null;
}
export function publicAnalysisJob(job: AnalysisJob | null) {
  return job
    ? {
        generation: job.generation,
        status: job.status,
        error: job.status === "failed" ? analysisError(job.error_code) : null,
      }
    : null;
}
export async function publishAnalysisJob(
  job: AnalysisJob | null,
  recovery = false,
) {
  if (
    !job ||
    !["queued", "processing"].includes(job.status) ||
    (!recovery && job.published_generation === job.generation)
  )
    return;
  await send(
    "diary-analysis",
    { jobId: job.id, generation: job.generation },
    {
      delaySeconds: 10,
      retentionSeconds: 604800,
      idempotencyKey: recovery
        ? `${job.generation}:recovery:${Math.floor(Date.now() / 900000)}`
        : job.generation,
    },
  );
  const { error } = await getDatabaseClient()
    .from("diary_analysis_jobs")
    .update({
      published_generation: job.generation,
      published_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("generation", job.generation);
  if (error) throw new Error("Analysis publication state unavailable");
}
export async function processAnalysisJob(jobId: string, generation: string) {
  const db = getDatabaseClient();
  const { data: claim, error } = await db.rpc("claim_diary_analysis", {
    p_job_id: jobId,
    p_generation: generation,
  });
  if (error) throw new Error("Analysis claim unavailable");
  if (!claim) return;
  if (claim.busy) throw new Error("Analysis already running");
  const params = {
    p_job_id: jobId,
    p_generation: generation,
    p_token: claim.token,
  };
  const finish = async (values: Record<string, unknown>) => {
    const { data, error } = await db.rpc("finish_diary_analysis", {
      ...params,
      ...values,
    });
    if (error) throw new Error("Analysis persistence unavailable");
    return data;
  };
  let extracted, mood;
  try {
    extracted = await extractDiaryPeople(
      claim.text,
      claim.date,
      await readAnalysisPeople(db, claim.userId),
    );
    mood = await analyzeDiaryMood(claim.text);
  } catch (error) {
    const result = await finish({
      p_mood: null,
      p_people: null,
      p_error: error instanceof AmbiguousPersonError ? "ambiguous" : "provider",
    });
    if (result?.retry)
      throw new Error("Analysis provider temporarily unavailable");
    return;
  }
  // Rebase optimistic person versions using the SAME model result, never another paid request.
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await readAnalysisPeople(db, claim.userId);
    const people = extracted.map((person) => {
      const existing = person.id
        ? current.find((p) => p.id === person.id)
        : undefined;
      return {
        id: existing?.id || (person.id ||= randomUUID()),
        name: existing?.name || person.name,
        version: existing?.updated_at || null,
        details: mergePersonInformation(
          existing?.details,
          person.information,
          claim.date,
        ),
      };
    });
    const result = await finish({
      p_mood: mood,
      p_people: people,
      p_error: null,
    });
    if (!result?.conflict) return;
  }
  await finish({ p_mood: null, p_people: null, p_error: "conflict" });
}
