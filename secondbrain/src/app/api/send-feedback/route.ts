import { NextRequest } from "next/server";
import { Resend } from "resend";
import { createHash } from "node:crypto";
import { getDatabaseClient } from "@/lib/supabase";
import { feedbackEmail } from "@/lib/email-templates";
import { getRequestUser } from "@/lib/api-auth";
import { dashboardJson } from "@/lib/dashboard-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return dashboardJson({ error: "No autorizado" }, 401);
    let body;
    try {
      body = await request.json();
    } catch {
      return dashboardJson({ error: "Formato no válido" }, 400);
    }
    if (
      !body ||
      !["suggestion", "problem"].includes(body.type) ||
      typeof body.message !== "string" ||
      !body.message.trim() ||
      body.message.length > 5000 ||
      (body.userEmail !== undefined &&
        (typeof body.userEmail !== "string" ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.userEmail)))
    )
      return dashboardJson(
        { error: "Escribe un mensaje de entre 1 y 5.000 caracteres" },
        400,
      );
    if (
      body.userEmail !== undefined &&
      user.email?.toLowerCase() !== body.userEmail.toLowerCase()
    )
      return dashboardJson(
        { error: "El correo debe coincidir con tu cuenta" },
        403,
      );
    const message = body.message.trim();
    const fingerprint = createHash("sha256")
      .update(
        `${user.uid}:${body.type}:${message}:${new Date().toISOString().slice(0, 13)}`,
      )
      .digest("hex");
    const { data, error } = await getDatabaseClient().rpc("submit_feedback", {
      p_user_id: user.uid,
      p_fingerprint: fingerprint,
      p_type: body.type,
      p_message: message,
    });
    if (error || !data)
      return dashboardJson(
        { error: "No se pudo guardar tu mensaje. Inténtalo de nuevo." },
        503,
      );
    if (!data.allowed)
      return dashboardJson(
        {
          error:
            "Has enviado demasiados mensajes. Inténtalo dentro de una hora.",
        },
        429,
      );
    // Database persistence is authoritative. Email is an optional notification;
    // provider failure never tells the user that a saved report was lost.
    let notified = false;
    const key = process.env.RESEND_API_KEY;
    if (
      user.email &&
      key &&
      key !== "re_placeholder_get_from_resend_dashboard"
    ) {
      try {
        const { error: mailError } = await new Resend(key).emails.send(
          {
            from: "SecondBrain <feedback@secondbrainapp.com>",
            to: ["josemariark@gmail.com"],
            ...feedbackEmail(body.type, user.email, message, new Date()),
            replyTo: user.email,
          },
          { idempotencyKey: `feedback-${fingerprint}` },
        );
        notified = !mailError;
      } catch {
        /* The saved report remains available to administrators. */
      }
    }
    return dashboardJson({
      success: true,
      id: data.id,
      saved: true,
      notified,
      message: "Mensaje guardado correctamente",
    });
  } catch {
    return dashboardJson(
      { error: "No se pudo guardar tu mensaje. Inténtalo de nuevo." },
      503,
    );
  }
}
