import { supabase } from "./supabase";

export async function authenticatedFetch(
  input: string,
  init: RequestInit = {},
) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token)
    throw new Error("Debes iniciar sesión");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  const response = await fetch(input, { ...init, headers });
  if (
    typeof window !== "undefined" &&
    (response.ok || response.status === 429) &&
    /\/api\/(personal-chat|chat-person|statistics\/report|stripe\/|subscription\/update-manual)/.test(
      input,
    )
  ) {
    window.dispatchEvent(new Event("subscription-updated"));
    try {
      localStorage.setItem(
        "secondbrain-subscription-updated",
        String(Date.now()),
      );
    } catch {
      /* Storage may be disabled. */
    }
  }
  return response;
}
