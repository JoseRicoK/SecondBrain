"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import type { DiaryEntry } from "@/lib/supabase-operations";
type State = {
  generation: string;
  status: "queued" | "processing" | "done" | "failed" | "skipped";
  error: string | null;
};
export function useDiaryAnalysis(
  entry: DiaryEntry | null,
  owner: string | undefined,
  onComplete: (entry: DiaryEntry) => void,
) {
  const [analysis, setAnalysis] = useState<State | null>(null);
  const [revision, setRevision] = useState(0);
  const callback = useRef(onComplete);
  callback.current = onComplete;
  const notified = useRef("");
  const restart = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    setAnalysis(null);
    if (!entry || entry.user_id !== owner) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const poll = async () => {
      if (controller.signal.aborted) return;
      if (document.hidden) {
        timer = setTimeout(poll, 5000);
        return;
      }
      attempts++;
      try {
        const response = await authenticatedFetch(
          `/api/diary-analysis?entryId=${encodeURIComponent(entry.id)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("State unavailable");
        const data = await response.json();
        if (controller.signal.aborted) return;
        setAnalysis(data.analysis);
        if (
          data.analysis?.status === "done" &&
          data.entry &&
          notified.current !== `${entry.id}:${data.analysis.generation}`
        ) {
          notified.current = `${entry.id}:${data.analysis.generation}`;
          callback.current(data.entry);
        }
        if (!["queued", "processing"].includes(data.analysis?.status)) return;
      } catch {
        if (controller.signal.aborted) return;
      }
      if (attempts < 100) timer = setTimeout(poll, 3000);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [entry?.id, entry?.updated_at, owner, revision]);
  return { analysis, restart };
}
