import { NextRequest, NextResponse } from "next/server";
import { getDatabaseClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const database = getDatabaseClient();
    const { data, error } = await database
      .from("subscriptions")
      .update({
        plan: "free",
        status: "canceled",
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq("cancel_at_period_end", true)
      .eq("status", "active")
      .lte("current_period_end", new Date().toISOString())
      .select("user_id");
    if (error) throw error;
    const expired = data?.length || 0;
    return NextResponse.json({
      success: true,
      processed: data?.length || 0,
      expired,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
