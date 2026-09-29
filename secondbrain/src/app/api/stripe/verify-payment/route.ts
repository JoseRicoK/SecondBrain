import { NextResponse } from "next/server";
import { getUserProfile } from "@/lib/subscription-operations";
import { getRequestUser } from "@/lib/api-auth";
import { getStripeClient } from "@/lib/stripe-server";
import { stripeObjectId, stripeSubscriptionData } from "@/lib/stripe-billing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { sessionId, userId } = await request.json();
    if (userId !== user.uid)
      return NextResponse.json({ error: "User mismatch" }, { status: 403 });
    if (typeof sessionId !== "string" || !sessionId)
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    const stripe = getStripeClient();
    if (!stripe)
      return NextResponse.json(
        { error: "Stripe no está configurado" },
        { status: 503 },
      );
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.uid !== user.uid)
      return NextResponse.json(
        { error: "Session does not belong to user" },
        { status: 403 },
      );
    if (session.mode !== "subscription" || session.payment_status !== "paid")
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 },
      );
    const id = stripeObjectId(session.subscription);
    if (!id)
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 409 },
      );
    const subscription = await stripe.subscriptions.retrieve(id);
    if (
      stripeObjectId(subscription.customer) !==
        stripeObjectId(session.customer) ||
      (subscription.metadata.uid && subscription.metadata.uid !== user.uid)
    )
      return NextResponse.json(
        { error: "Subscription owner mismatch" },
        { status: 403 },
      );
    const snapshot = stripeSubscriptionData(subscription);
    if (snapshot.status !== "active")
      return NextResponse.json(
        { error: "La suscripción todavía no está activa" },
        { status: 409 },
      );
    const profile = await getUserProfile(user.uid);
    const activated =
      profile?.subscription.stripeSubscriptionId === subscription.id &&
      profile.subscription.status === "active" &&
      profile.subscription.plan === snapshot.plan;
    // Never provision from a browser return. A delayed webhook will be retried by Stripe.
    return NextResponse.json({
      success: true,
      activated,
      plan: snapshot.plan,
      status: snapshot.status,
      message:
        "Pago confirmado. El estado de tu plan se sincroniza mediante el webhook.",
    });
  } catch (error) {
    console.error("Payment verification failed", error);
    return NextResponse.json(
      { error: "Error verifying payment" },
      { status: 500 },
    );
  }
}
