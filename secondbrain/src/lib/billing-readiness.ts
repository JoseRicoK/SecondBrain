import { getDatabaseClient } from "./supabase";
export async function hasBillingSchema(): Promise<boolean> {
  const { data, error } = await getDatabaseClient().rpc(
    "billing_schema_version",
  );
  return !error && data === 2;
}
