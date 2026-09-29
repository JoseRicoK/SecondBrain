import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getDatabaseClient } from "@/lib/supabase";
import { feedbackEmail } from "@/lib/email-templates";
import { createHash } from "node:crypto";
import { getRequestUser } from "@/lib/api-auth";

interface FeedbackRequest {
  type: "suggestion" | "problem";
  message: string;
  userEmail: string;
}

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);
export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const body: FeedbackRequest = await request.json();
    const { type, message, userEmail } = body;

    // Validar los datos recibidos
    if (
      !["suggestion", "problem"].includes(type) ||
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 5000 ||
      typeof userEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)
    ) {
      return NextResponse.json(
        { error: "Faltan datos requeridos" },
        { status: 400 },
      );
    }

    // Validar que la API key esté configurada
    if (
      !process.env.RESEND_API_KEY ||
      process.env.RESEND_API_KEY === "re_placeholder_get_from_resend_dashboard"
    ) {
      console.error("❌ RESEND: API key no configurada");
      return NextResponse.json(
        { error: "Servicio de correo no configurado" },
        { status: 500 },
      );
    }

    if (user.email?.toLowerCase() !== userEmail.toLowerCase())
      return NextResponse.json(
        { error: "El correo debe coincidir con tu cuenta" },
        { status: 403 },
      );
    const email = feedbackEmail(type, user.email, message.trim(), new Date());
    const fingerprint = createHash("sha256")
      .update(
        `${user.uid}:${type}:${message.trim()}:${new Date().toISOString().slice(0, 13)}`,
      )
      .digest("hex");

    const { data: allowed, error: quotaError } = await getDatabaseClient().rpc(
      "reserve_feedback",
      { p_user_id: user.uid, p_id: fingerprint },
    );
    if (quotaError) throw quotaError;
    if (!allowed)
      return NextResponse.json(
        {
          error:
            "Has enviado demasiados mensajes. Inténtalo dentro de una hora.",
        },
        { status: 429 },
      );

    // Enviar el email usando Resend
    const { data, error } = await resend.emails.send(
      {
        from: "SecondBrain <feedback@secondbrainapp.com>",
        to: ["josemariark@gmail.com"],
        ...email,
        replyTo: user.email, // Para poder responder directamente al usuario
      },
      { idempotencyKey: `feedback-${fingerprint}` },
    );

    if (error) {
      console.error("❌ RESEND: Error al enviar correo:", error);
      return NextResponse.json(
        { error: "Error al enviar el correo" },
        { status: 500 },
      );
    }

    console.log("✅ RESEND: Correo enviado exitosamente:", data?.id);

    return NextResponse.json({
      success: true,
      message: "Mensaje enviado correctamente",
      emailId: data?.id,
    });
  } catch (error) {
    console.error("❌ SEND-FEEDBACK: Error general:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
