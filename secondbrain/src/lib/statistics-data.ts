import { getDatabaseClient } from "./supabase";

// Call only after authenticating and checking the effective paid plan.
export async function readAnalyticsPeople(userId: string) {
  const people: { id: string; name: string; details: unknown }[] = [];
  let after: string | null = null;
  for (;;) {
    let query = getDatabaseClient()
      .from("people")
      .select("id, name, details")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .limit(500);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error("People query failed");
    people.push(...(data || []));
    if (!data || data.length < 500) break;
    const next = data.at(-1)!.id;
    if (after && next <= after) throw new Error("Invalid person pagination");
    after = next;
  }
  return people;
}
