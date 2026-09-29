import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getDatabaseClient } from "@/lib/supabase";
import { billingEmail } from "@/lib/email-templates";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    process.env.BILLING_EMAILS_ENABLED !== "true" ||
    !process.env.RESEND_API_KEY
  )
    return NextResponse.json(
      { error: "Los correos de facturación están desactivados" },
      { status: 503 },
    );
  try {
    const db = getDatabaseClient();
    const { data: jobs, error } = await db.rpc("claim_billing_emails");
    if (error) throw error;
    const resend = new Resend(process.env.RESEND_API_KEY);
    let sent = 0;
    for (const job of jobs || []) {
      let success = false;
      try {
        // Auth is authoritative for recipients; browser-editable profile email is not.
        const { data, error: authError } = await db.auth.admin.getUserById(
          job.user_id,
        );
        if (authError || !data.user?.email || !data.user.email_confirmed_at)
          throw new Error("Verified recipient unavailable");
        const payload = job.payload;
        const message = billingEmail(
          payload.plan,
          payload.status,
          payload.cancelAtPeriodEnd,
          payload.currentPeriodEnd,
        );
        const result = await resend.emails.send(
          {
            from: "SecondBrain <feedback@secondbrainapp.com>",
            to: [data.user.email],
            ...message,
          },
          { idempotencyKey: `billing-${job.event_id}` },
        );
        if (result.error) throw result.error;
        success = true;
      } catch (sendError) {
        console.error("Billing email failed", { event: job.event_id });
      }
      const { error: updateError } = await db
        .from("billing_email_outbox")
        .update({
          status: success ? "sent" : "pending",
          sent_at: success ? new Date().toISOString() : null,
          lease_until: null,
        })
        .eq("event_id", job.event_id)
        .eq("attempts", job.attempts)
        .eq("status", "sending");
      if (updateError) throw updateError;
      if (success) sent++;
    }
    return NextResponse.json({ processed: jobs?.length || 0, sent });
  } catch {
    return NextResponse.json(
      { error: "No se pudo procesar la cola de correos" },
      { status: 500 },
    );
  }
}
