import { NextRequest, NextResponse } from "next/server";
import {
  getUserProfile,
  updateUserSubscription,
} from "@/lib/subscription-operations";
import { getRequestUser } from "@/lib/api-auth";
import { verifyStripePrice } from "@/lib/stripe-billing";
import { getStripeClient, isCheckoutEnabled } from "@/lib/stripe-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!isCheckoutEnabled()) {
      return NextResponse.json(
        { error: "Los pagos todavía no están disponibles" },
        { status: 503 },
      );
    }
    const stripe = getStripeClient();
    if (!stripe)
      return NextResponse.json(
        { error: "Los pagos todavía no están disponibles" },
        { status: 503 },
      );
    const user = await getRequestUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const {
      planType,
      userId,
      userEmail,
      successUrl,
      cancelUrl,
      requestId,
    } = await req.json();
    if (
      user.uid !== userId ||
      user.email?.toLowerCase() !== String(userEmail).toLowerCase()
    ) {
      return NextResponse.json({ error: "User mismatch" }, { status: 403 });
    }
    void successUrl;
    void cancelUrl;

    if (!planType || !userId || !userEmail) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    // Mapear tipos de plan a Price IDs
    const priceIdMap = {
      pro: process.env.STRIPE_PRO_PRICE_ID,
      elite: process.env.STRIPE_ELITE_PRICE_ID,
    };

    const priceId = priceIdMap[planType as keyof typeof priceIdMap];

    if (!priceId) {
      console.error("Price ID no encontrado para plan:", planType);
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    await verifyStripePrice(stripe, planType as "pro" | "elite", priceId);
    if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId))
      return NextResponse.json(
        { error: "Invalid checkout request ID" },
        { status: 400 },
      );
    const profile = await getUserProfile(user.uid);
    if (!profile)
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    if (
      profile.subscription.stripeSubscriptionId &&
      profile.subscription.status !== "canceled" &&
      profile.subscription.status !== "inactive"
    ) {
      if (!profile.subscription.stripeCustomerId)
        return NextResponse.json(
          { error: "No existe cliente de facturación" },
          { status: 409 },
        );
      const portal = await stripe.billingPortal.sessions.create({
        customer: profile.subscription.stripeCustomerId,
        return_url: `${req.nextUrl.origin}/subscription`,
        locale: "es",
      });
      return NextResponse.json({ portalUrl: portal.url });
    }
    let customerId = profile.subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: user.email!, metadata: { uid: user.uid } },
        { idempotencyKey: `secondbrain-customer-${user.uid}` },
      );
      customerId = customer.id;
      await updateUserSubscription(user.uid, { stripeCustomerId: customerId });
    }

    // Crear la sesión de checkout
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        customer: customerId,
        metadata: {
          uid: userId, // Cambiado de userId a uid para consistencia
          plan_type: planType,
          user_email: userEmail,
        },
        success_url: `${req.nextUrl.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.nextUrl.origin}/subscription`,
        subscription_data: {
          metadata: {
            uid: userId, // Cambiado de userId a uid para consistencia
            plan_type: planType,
            user_email: userEmail,
          },
        },
      },
      {
        idempotencyKey: `secondbrain-checkout-${user.uid}-${planType}-${requestId}`,
      },
    );

    console.log("✅ Sesión de checkout creada:", session.id);
    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Error creating checkout session" },
      { status: 500 },
    );
  }
}
