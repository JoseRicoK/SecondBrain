import {
  claimCheckoutAttempt,
  registerCheckoutSession,
} from "@/lib/checkout-attempts";
import { hasBillingSchema } from "@/lib/billing-readiness";
import { NextRequest, NextResponse } from "next/server";
import {
  getUserProfile,
  updateUserSubscription,
} from "@/lib/subscription-operations";
import { getRequestUser } from "@/lib/api-auth";
import { verifyStripePrice } from "@/lib/stripe-billing";
import {
  getStripeClient,
  isCheckoutEnabled,
  getBillingOrigin,
} from "@/lib/stripe-server";

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
    if (!(await hasBillingSchema()))
      return NextResponse.json(
        { error: "La configuración de pagos está pendiente" },
        { status: 503 },
      );
    const stripe = getStripeClient();
    if (!stripe)
      return NextResponse.json(
        { error: "Los pagos todavía no están disponibles" },
        { status: 503 },
      );
    const user = await getRequestUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { planType, userId, userEmail, successUrl, cancelUrl, requestId } =
      await req.json();
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

    if (!["pro", "elite"].includes(planType))
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    const priceId = priceIdMap[planType as keyof typeof priceIdMap];

    if (!priceId) {
      console.error("Price ID no encontrado para plan:", planType);
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    if (
      typeof requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestId,
      )
    )
      return NextResponse.json(
        { error: "Invalid checkout request ID" },
        { status: 400 },
      );
    const profile = await getUserProfile(user.uid);
    if (!profile)
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    const origin = getBillingOrigin();
    let existing = false;
    if (profile.subscription.stripeSubscriptionId) {
      // Provider status is authoritative, including incomplete payments not yet reflected locally.
      const current = await stripe.subscriptions.retrieve(
        profile.subscription.stripeSubscriptionId,
      );
      const customer =
        typeof current.customer === "string"
          ? current.customer
          : current.customer.id;
      if (
        customer !== profile.subscription.stripeCustomerId ||
        (current.metadata.uid && current.metadata.uid !== user.uid)
      )
        return NextResponse.json(
          { error: "Subscription owner mismatch" },
          { status: 403 },
        );
      existing = !["canceled", "incomplete_expired"].includes(current.status);
      if (
        !existing &&
        profile.subscription.status !== "canceled" &&
        profile.subscription.status !== "inactive"
      )
        await updateUserSubscription(user.uid, {
          status: "canceled",
          plan: "free",
        });
    }
    if (existing) {
      if (!profile.subscription.stripeCustomerId)
        return NextResponse.json(
          { error: "No existe cliente de facturación" },
          { status: 409 },
        );
      const portal = await stripe.billingPortal.sessions.create({
        customer: profile.subscription.stripeCustomerId,
        return_url: `${origin}/subscription`,
        locale: "es",
      });
      return NextResponse.json({ portalUrl: portal.url });
    }
    await verifyStripePrice(stripe, planType as "pro" | "elite", priceId);
    let customerId = profile.subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: user.email!, metadata: { uid: user.uid } },
        { idempotencyKey: `secondbrain-customer-${user.uid}` },
      );
      customerId = customer.id;
      await updateUserSubscription(user.uid, { stripeCustomerId: customerId });
    }

    // Cover provider subscriptions that have not yet reached the local signed webhook.
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });
    const pending = subscriptions.data.find(
      (item) => !["canceled", "incomplete_expired"].includes(item.status),
    );
    if (pending) {
      if (pending.metadata.uid && pending.metadata.uid !== user.uid)
        return NextResponse.json(
          { error: "Subscription owner mismatch" },
          { status: 403 },
        );
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/subscription`,
        locale: "es",
      });
      return NextResponse.json({ portalUrl: portal.url });
    }
    if (subscriptions.has_more)
      return NextResponse.json(
        { error: "Es necesario revisar el historial de facturación" },
        { status: 409 },
      );
    const attempt = await claimCheckoutAttempt(
      user.uid,
      requestId,
      planType as "pro" | "elite",
    );
    if (attempt.plan !== planType)
      return NextResponse.json(
        {
          error: `Hay un intento de pago ${attempt.plan.toUpperCase()} pendiente. Retómalo o cancélalo para cambiar de plan.`,
          code: "CHECKOUT_PENDING",
        },
        { status: 409 },
      );
    if (attempt.sessionId) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        attempt.sessionId,
      );
      if (
        existingSession.metadata?.uid !== user.uid ||
        (typeof existingSession.customer === "string"
          ? existingSession.customer
          : existingSession.customer?.id) !== customerId
      )
        return NextResponse.json(
          { error: "Checkout owner mismatch" },
          { status: 403 },
        );
      if (existingSession.status === "open" && existingSession.url)
        return NextResponse.json({
          sessionId: existingSession.id,
          checkoutUrl: existingSession.url,
        });
      return NextResponse.json(
        {
          error:
            "El intento de pago ya terminó. Actualiza el estado o cancela el intento para empezar otro.",
          code: "CHECKOUT_PENDING",
        },
        { status: 409 },
      );
    }
    // Crear la sesión de checkout
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        integration_identifier: "secondbrain_checkout_hqynbfks",
        consent_collection: { terms_of_service: "required" },
        custom_text: {
          terms_of_service_acceptance: {
            message:
              "Acepto los [términos de LumaDiary](https://www.lumadiary.com/terminos) y he leído la [política de privacidad](https://www.lumadiary.com/privacidad).",
          },
          submit: {
            message:
              "Suscripción mensual con renovación automática. Puedes cancelar desde tu cuenta. Reembolso del último cargo mensual si lo solicitas dentro de 30 días.",
          },
        },
        expires_at: Math.floor(new Date(attempt.expiresAt).getTime() / 1000),
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
        },
        success_url: `${origin}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/subscription`,
        subscription_data: {
          metadata: {
            uid: userId, // Cambiado de userId a uid para consistencia
            plan_type: planType,
          },
        },
      },
      {
        idempotencyKey: `secondbrain-checkout-${user.uid}-${planType}-${attempt.requestId}`,
      },
    );

    if (!session.url) throw new Error("Checkout URL missing");
    await registerCheckoutSession(user.uid, attempt.requestId, session.id);
    return NextResponse.json({
      sessionId: session.id,
      checkoutUrl: session.url,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Error creating checkout session" },
      { status: 500 },
    );
  }
}
