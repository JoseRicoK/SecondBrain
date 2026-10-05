"use client";
import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
export class DashboardAccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function useDashboardResource<T>(
  url: string | null,
  revision: number,
  onDenied: () => void,
) {
  const [state, setState] = useState<{
    url: string | null;
    revision: number;
    data: T | null;
    loading: boolean;
    error: string;
  }>({ url: null, revision: -1, data: null, loading: false, error: "" });
  useEffect(() => {
    if (!url) {
      setState({ url, revision, data: null, loading: false, error: "" });
      return;
    }
    const controller = new AbortController();
    setState({ url, revision, data: null, loading: true, error: "" });
    void authenticatedFetch(url, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new DashboardAccessError(
            response.status,
            data.error || "No se pudo cargar la información",
          );
        if (!controller.signal.aborted)
          setState({ url, revision, data, loading: false, error: "" });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (
          error instanceof DashboardAccessError &&
          [401, 403].includes(error.status)
        )
          onDenied();
        setState({
          url,
          revision,
          data: null,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "No se pudo cargar la información",
        });
      });
    return () => controller.abort();
  }, [url, revision, onDenied]);
  // Never render a previous filter/account's data during the effect transition.
  return state.url === url && state.revision === revision
    ? state
    : { data: null, loading: Boolean(url), error: "" };
}
