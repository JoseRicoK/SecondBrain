import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { getStripeClient } from "@/lib/stripe-server";
import {
  readCheckoutAttempt,
  releaseCheckoutAttempt,
} from "@/lib/checkout-attempts";
export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const attempt = await readCheckoutAttempt(user.uid);
    if (!attempt) return NextResponse.json({ success: true });
    if (!attempt.sessionId)
      return NextResponse.json(
        {
          error:
            "El intento se está preparando. Reintenta el plan original antes de cancelarlo.",
        },
        { status: 409 },
      );
    const stripe = getStripeClient();
    if (!stripe)
      return NextResponse.json(
        { error: "Facturación no disponible" },
        { status: 503 },
      );
    const session = await stripe.checkout.sessions.retrieve(attempt.sessionId);
    if (session.metadata?.uid !== user.uid)
      return NextResponse.json(
        { error: "Checkout owner mismatch" },
        { status: 403 },
      );
    if (session.status === "complete")
      return NextResponse.json(
        { error: "El pago ya terminó. Actualiza el estado de tu suscripción." },
        { status: 409 },
      );
    if (session.status === "open")
      await stripe.checkout.sessions.expire(session.id);
    else if (session.status !== "expired")
      return NextResponse.json(
        { error: "El intento de pago aún no se puede cancelar" },
        { status: 409 },
      );
    await releaseCheckoutAttempt(user.uid, attempt.requestId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "No se pudo cancelar el intento de pago" },
      { status: 502 },
    );
  }
}
