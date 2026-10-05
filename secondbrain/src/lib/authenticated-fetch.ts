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
  let response = await fetch(input, { ...init, headers });
  // A session can expire between getSession and the server's validation.
  // Retry only unauthenticated requests; plan/quota rejections must stay intact.
  if (response.status === 401 && !init.signal?.aborted) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) {
      // Never replay a request under another account after an account switch.
      if (refreshed.session.user.id !== data.session.user.id) return response;
      headers.set("Authorization", `Bearer ${refreshed.session.access_token}`);
      response = await fetch(input, { ...init, headers });
    }
  }
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
