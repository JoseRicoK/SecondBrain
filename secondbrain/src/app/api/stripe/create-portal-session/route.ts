import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/api-auth";
import { getStripeClient, isCheckoutEnabled } from "@/lib/stripe-server";
import { getUserProfile } from "@/lib/subscription-operations";
export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isCheckoutEnabled())
      return NextResponse.json(
        { error: "La gestión de pagos estará disponible próximamente" },
        { status: 503 },
      );
    const profile = await getUserProfile(user.uid);
    const stripe = getStripeClient();
    if (!stripe || !profile?.subscription.stripeCustomerId)
      return NextResponse.json(
        { error: "No existe un cliente de facturación" },
        { status: 409 },
      );
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.subscription.stripeCustomerId,
      return_url: `${new URL(request.url).origin}/subscription`,
      locale: "es",
    });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json(
      { error: "No se pudo iniciar la gestión de suscripción" },
      { status: 500 },
    );
  }
}
