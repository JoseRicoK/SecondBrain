import { randomUUID } from "node:crypto";
import type { getDatabaseClient } from "./supabase";
import {
  analyzeDiaryMood,
  extractDiaryPeople,
  type ExtractedPerson,
} from "./diary-analysis";
import { mergePersonInformation } from "./person-information";
import type { ReanalysisJob } from "./diary-reanalysis-types";

type Database = ReturnType<typeof getDatabaseClient>;
type Claim = {
  entryId: string;
  userId: string;
  date: string;
  text: string;
  includePeople: boolean;
  token: string;
};
type PersonRow = {
  id: string;
  name: string;
  updated_at: string;
  details: Record<string, never>;
};
export class ReanalysisDatabaseError extends Error {
  constructor(public code?: string) {
    super("Reanalysis database unavailable");
  }
}
async function rpc<T>(
  database: Database,
  name: string,
  params: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await database.rpc(name, params);
  if (error) throw new ReanalysisDatabaseError(error.code);
  return data as T;
}
export async function readAnalysisPeople(database: Database, owner: string) {
  const result: PersonRow[] = [];
  let after: string | null = null;
  for (;;) {
    let query = database
      .from("people")
      .select("id, name, details, updated_at")
      .eq("user_id", owner)
      .order("id", { ascending: true })
      .limit(500);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new ReanalysisDatabaseError(error.code);
    result.push(...((data || []) as PersonRow[]));
    if (!data || data.length < 500) return result;
    const next = data.at(-1)!.id;
    if (after && next <= after) throw new Error("Invalid catalogue pagination");
    after = next;
  }
}
export async function processReanalysis(
  database: Database,
  actor: string,
  jobId: string,
) {
  const claimed = await rpc<{
    job: ReanalysisJob;
    busy?: boolean;
    claim?: Claim;
  } | null>(database, "admin_claim_reanalysis", {
    p_actor: actor,
    p_job_id: jobId,
  });
  if (!claimed?.claim) return claimed;
  const claim = claimed.claim;
  const base = {
    p_actor: actor,
    p_job_id: jobId,
    p_entry_id: claim.entryId,
    p_token: claim.token,
  };
  let mood;
  let extracted: ExtractedPerson[] | null = null;
  try {
    // Existing analyses leave the people catalogue and mentioned_people untouched.
    if (claim.includePeople)
      extracted = await extractDiaryPeople(
        claim.text,
        claim.date,
        await readAnalysisPeople(database, claim.userId),
      );
    mood = await analyzeDiaryMood(claim.text);
  } catch (error) {
    if (error instanceof ReanalysisDatabaseError && error.code === "42501")
      throw error;
    return rpc<{ job: ReanalysisJob }>(database, "admin_finish_reanalysis", {
      ...base,
      p_mood: null,
      p_people: null,
      p_error: "provider",
    });
  }
  // Retry optimistic conflicts with the same validated model result; never call AI again just to rebase facts.
  for (let attempt = 0; attempt < 3; attempt++) {
    let people = null;
    if (extracted) {
      const current = await readAnalysisPeople(database, claim.userId);

      people = extracted.map((person) => {
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
    }
    const result = await rpc<{
      job: ReanalysisJob;
      conflict?: boolean;
      stale?: boolean;
    }>(database, "admin_finish_reanalysis", {
      ...base,
      p_mood: mood,
      p_people: people,
      p_error: null,
    });
    if (!result?.conflict) return result;
  }
  return rpc<{ job: ReanalysisJob }>(database, "admin_finish_reanalysis", {
    ...base,
    p_mood: null,
    p_people: null,
    p_error: "invalid",
  });
}
