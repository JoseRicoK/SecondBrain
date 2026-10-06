import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabaseClient } from "@/lib/supabase";
import {
  publishAnalysisJob,
  type AnalysisJob,
} from "@/lib/diary-analysis-jobs";
export const maxDuration = 240;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") || "";
  const target = `Bearer ${expected}`;
  if (
    !expected ||
    supplied.length !== target.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(target))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await getDatabaseClient()
    .from("diary_analysis_jobs")
    .select("*")
    .in("status", ["queued", "processing"])
    .lt("updated_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .order("updated_at")
    .limit(500);
  if (error)
    return NextResponse.json(
      { error: "Recovery unavailable" },
      { status: 503 },
    );
  let published = 0;
  for (const job of (data || []) as AnalysisJob[]) {
    try {
      await publishAnalysisJob(job, true);
      published++;
    } catch {
      /* Remains durable for the next recovery. */
    }
  }
  return NextResponse.json(
    { published },
    { headers: { "Cache-Control": "no-store" } },
  );
}
