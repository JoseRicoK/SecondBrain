import { hasBillingSchema } from "@/lib/billing-readiness";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe-server";
import { stripeObjectId, syncStripeSubscription } from "@/lib/stripe-billing";
import { markFirstPaymentComplete } from "@/lib/subscription-operations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const stripe = getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret)
    return NextResponse.json(
      { error: "Stripe no está configurado" },
      { status: 503 },
    );
  const signature = request.headers.get("stripe-signature");
  if (!signature)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    if (!(await hasBillingSchema()))
      return NextResponse.json(
        { error: "Billing schema pending" },
        { status: 503 },
      );
    let subscriptionId: string | null = null;
    let checkoutOwner: string | undefined;
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || session.payment_status !== "paid")
        return NextResponse.json({ received: true });
      checkoutOwner = session.metadata?.uid;
      if (!checkoutOwner) throw new Error("Checkout missing owner");
      subscriptionId = stripeObjectId(session.subscription);
    } else if (
      [
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ].includes(event.type)
    ) {
      subscriptionId = (event.data.object as Stripe.Subscription).id;
    } else if (
      [
        "invoice.paid",
        "invoice.payment_succeeded",
        "invoice.payment_failed",
      ].includes(event.type)
    ) {
      const invoice = event.data.object as Stripe.Invoice;
      // Retrieve with the pinned API version instead of trusting a potentially legacy webhook shape.
      if (!invoice.id) throw new Error("Invoice ID missing");
      const latest = await stripe.invoices.retrieve(invoice.id);
      subscriptionId = stripeObjectId(
        latest.parent?.subscription_details?.subscription || null,
      );
    } else return NextResponse.json({ received: true });
    if (!subscriptionId) throw new Error("Billing event missing subscription");
    // Re-read current Stripe state for all event types, including late invoice events.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice"],
    });
    const result = await syncStripeSubscription(
      subscription,
      event,
      checkoutOwner,
      stripe,
    );
    if (
      checkoutOwner &&
      result.owner &&
      result.applied &&
      result.snapshot?.status === "active"
    )
      await markFirstPaymentComplete(result.owner);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Billing event processing failed", error);
    return NextResponse.json(
      { error: "Error processing webhook" },
      { status: 500 },
    );
  }
}
