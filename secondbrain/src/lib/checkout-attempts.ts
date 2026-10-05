import { getDatabaseClient } from "./supabase";
export interface CheckoutAttempt {
  requestId: string;
  plan: "pro" | "elite";
  sessionId: string | null;
  expiresAt: string;
}
export async function claimCheckoutAttempt(
  uid: string,
  requestId: string,
  plan: "pro" | "elite",
): Promise<CheckoutAttempt> {
  const { data, error } = await getDatabaseClient().rpc(
    "claim_checkout_attempt",
    { p_user_id: uid, p_request_id: requestId, p_plan: plan },
  );
  if (error || !data)
    throw error || new Error("No se pudo reservar el intento de pago");
  return data;
}
export async function registerCheckoutSession(
  uid: string,
  requestId: string,
  sessionId: string,
) {
  const { error } = await getDatabaseClient().rpc("register_checkout_session", {
    p_user_id: uid,
    p_request_id: requestId,
    p_session_id: sessionId,
  });
  if (error) throw error;
}
export async function readCheckoutAttempt(
  uid: string,
): Promise<CheckoutAttempt | null> {
  const { data, error } = await getDatabaseClient()
    .from("billing_checkout_attempts")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        requestId: data.request_id,
        plan: data.plan,
        sessionId: data.session_id,
        expiresAt: data.expires_at,
      }
    : null;
}
export async function releaseCheckoutAttempt(uid: string, requestId: string) {
  const { error } = await getDatabaseClient()
    .from("billing_checkout_attempts")
    .delete()
    .eq("user_id", uid)
    .eq("request_id", requestId);
  if (error) throw error;
}
