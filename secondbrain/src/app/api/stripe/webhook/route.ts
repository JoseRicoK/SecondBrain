import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateUserSubscription, findUserByStripeCustomerId, markFirstPaymentComplete } from '@/lib/subscription-operations';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ [Stripe Webhook] Error verificando signature:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('🎣 [Stripe Webhook] Evento recibido:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`🤷 [Stripe Webhook] Evento no manejado: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ [Stripe Webhook] Error procesando evento:', error);
    return NextResponse.json({ error: 'Error processing webhook' }, { status: 500 });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('💳 [Stripe Webhook] Checkout completado:', session.id);

  if (!session.customer || !session.metadata?.uid) {
    console.error('❌ [Stripe Webhook] Faltan datos del customer o uid en metadata');
    return;
  }

  const uid = session.metadata.uid;
  const planType = session.metadata.plan_type as 'basic' | 'pro' | 'elite';

  if (!planType) {
    console.error('❌ [Stripe Webhook] No se encontró plan_type en metadata');
    return;
  }

  // Si hay una suscripción, obtener los detalles
  if (session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    
    await updateUserSubscription(uid, {
      plan: planType,
      status: 'active',
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end || false,
    });

    // Marcar que este usuario completó su primer pago
    await markFirstPaymentComplete(uid);

    console.log('✅ [Stripe Webhook] Suscripción activada para usuario:', uid);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('🔄 [Stripe Webhook] Suscripción actualizada:', subscription.id);

  // Buscar el usuario por customer ID
  const uid = await findUserByCustomerId(subscription.customer as string);
  if (!uid) {
    console.error('❌ [Stripe Webhook] No se encontró usuario para customer:', subscription.customer);
    return;
  }

  // Determinar el plan basado en el precio
  const planType = await getPlanTypeFromSubscription(subscription);
  if (!planType) {
    console.error('❌ [Stripe Webhook] No se pudo determinar el tipo de plan');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = mapStripeStatusToOurs((subscription as any).status);

  await updateUserSubscription(uid, {
    plan: planType,
    status,
    stripeSubscriptionId: subscription.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end || false,
  });

  console.log('✅ [Stripe Webhook] Suscripción actualizada para usuario:', uid);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('❌ [Stripe Webhook] Suscripción cancelada:', subscription.id);

  const uid = await findUserByCustomerId(subscription.customer as string);
  if (!uid) {
    console.error('❌ [Stripe Webhook] No se encontró usuario para customer:', subscription.customer);
    return;
  }

  await updateUserSubscription(uid, {
    plan: 'free',
    status: 'canceled',
    cancelAtPeriodEnd: false,
  });

  console.log('✅ [Stripe Webhook] Usuario movido a plan gratuito:', uid);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('💰 [Stripe Webhook] Pago exitoso:', invoice.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(invoice as any).subscription) return;

  const uid = await findUserByCustomerId(invoice.customer as string);
  if (!uid) return;

  // Actualizar la fecha de fin del período actual
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string);
  
  await updateUserSubscription(uid, {
    status: 'active',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
  });

  console.log('✅ [Stripe Webhook] Pago procesado para usuario:', uid);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('❌ [Stripe Webhook] Pago fallido:', invoice.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(invoice as any).subscription) return;

  const uid = await findUserByCustomerId(invoice.customer as string);
  if (!uid) return;

  await updateUserSubscription(uid, {
    status: 'past_due',
  });

  console.log('⚠️ [Stripe Webhook] Suscripción marcada como vencida para usuario:', uid);
}

// Funciones auxiliares

async function findUserByCustomerId(customerId: string): Promise<string | null> {
  return await findUserByStripeCustomerId(customerId);
}

async function getPlanTypeFromSubscription(subscription: Stripe.Subscription): Promise<'basic' | 'pro' | 'elite' | null> {
  const priceId = subscription.items.data[0]?.price.id;
  
  if (priceId === process.env.STRIPE_PRICE_ID_BASIC) return 'basic';
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_ID_ELITE) return 'elite';
  
  return null;
}

function mapStripeStatusToOurs(stripeStatus: string): 'active' | 'inactive' | 'canceled' | 'past_due' {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'canceled':
    case 'unpaid':
      return 'canceled';
    case 'past_due':
      return 'past_due';
    case 'incomplete':
    case 'incomplete_expired':
    case 'trialing':
    case 'paused':
    default:
      return 'inactive';
  }
}
