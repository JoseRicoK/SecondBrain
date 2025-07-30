import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateUserSubscription, markFirstPaymentComplete, UserSubscription } from '@/lib/subscription-operations';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

export async function POST(req: NextRequest) {
  try {
    const { sessionId, userId } = await req.json();

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'Missing sessionId or userId' },
        { status: 400 }
      );
    }

    console.log('🔍 [Stripe Verify] Verificando sesión:', sessionId, 'para usuario:', userId);

    // Obtener la sesión de checkout desde Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    });

    console.log('📋 [Stripe Verify] Sesión obtenida:', {
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      customer: session.customer,
      subscription: typeof session.subscription === 'object' ? session.subscription?.id : session.subscription,
      metadata: session.metadata
    });

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed', session },
        { status: 400 }
      );
    }

    // Verificar que la sesión pertenece al usuario
    const sessionUserId = session.metadata?.uid;
    if (sessionUserId !== userId) {
      console.error('❌ [Stripe Verify] Usuario no coincide:', { sessionUserId, userId });
      return NextResponse.json(
        { error: 'Session does not belong to user' },
        { status: 403 }
      );
    }

    // Obtener el tipo de plan de los metadatos
    const planType = session.metadata?.plan_type;
    if (!planType || !['pro', 'elite'].includes(planType)) {
      console.error('❌ [Stripe Verify] Plan type inválido:', planType);
      return NextResponse.json(
        { error: 'Invalid plan type in session metadata' },
        { status: 400 }
      );
    }

    // Actualizar la suscripción en Firebase
    const subscriptionData: Partial<UserSubscription> = {
      plan: planType as 'pro' | 'elite',
      status: 'active',
      stripeCustomerId: session.customer as string,
    };

    // Si hay una suscripción, agregar más detalles
    if (session.subscription && typeof session.subscription === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = session.subscription as any;
      subscriptionData.stripeSubscriptionId = subscription.id;
      subscriptionData.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      subscriptionData.cancelAtPeriodEnd = subscription.cancel_at_period_end;
    }

    await updateUserSubscription(userId, subscriptionData);

    // Marcar que este usuario completó su primer pago
    await markFirstPaymentComplete(userId);

    console.log('✅ [Stripe Verify] Suscripción actualizada correctamente para usuario:', userId);

    return NextResponse.json({ 
      success: true, 
      message: 'Subscription updated successfully',
      plan: planType,
      status: 'active'
    });
  } catch (error) {
    console.error('❌ [Stripe Verify] Error verificando pago:', error);
    return NextResponse.json(
      { error: 'Error verifying payment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
