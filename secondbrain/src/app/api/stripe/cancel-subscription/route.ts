import { NextRequest, NextResponse } from 'next/server';
import { updateUserSubscription, getUserProfile } from '@/lib/subscription-operations';
import { getRequestUser } from '@/lib/api-auth';
import { getStripeClient } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId } = await req.json();
    if (user.uid !== userId) return NextResponse.json({ error: 'User mismatch' }, { status: 403 });

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID es requerido' },
        { status: 400 }
      );
    }

    // Obtener la suscripción actual del usuario
    const userProfile = await getUserProfile(userId);
    
    if (!userProfile) {
      return NextResponse.json(
        { error: 'No se encontró usuario' },
        { status: 404 }
      );
    }

    const userSubscription = userProfile.subscription;

    if (userSubscription.plan === 'free') {
      return NextResponse.json(
        { error: 'El plan gratuito no requiere cancelación' },
        { status: 400 }
      );
    }

    let currentPeriodEndDate: Date;

    // Si no hay stripeSubscriptionId, es entorno de desarrollo
    if (!userSubscription.stripeSubscriptionId) {
      // Crear fecha de expiración: un mes desde ahora
      currentPeriodEndDate = new Date();
      currentPeriodEndDate.setMonth(currentPeriodEndDate.getMonth() + 1);
    } else {
      const stripe = getStripeClient();
      if (!stripe) return NextResponse.json({ error: 'Stripe no está configurado' }, { status: 503 });
      // Intentar cancelar en Stripe si tenemos una suscripción real
      try {
        const canceledSubscription = await stripe.subscriptions.update(
          userSubscription.stripeSubscriptionId,
          {
            cancel_at_period_end: true,
          }
        );

        // Obtener la fecha de fin del período actual desde la suscripción cancelada
        const subscription = canceledSubscription as unknown as { current_period_end: number };
        const currentPeriodEndTimestamp = subscription.current_period_end;
        
        if (currentPeriodEndTimestamp && currentPeriodEndTimestamp > 0) {
          currentPeriodEndDate = new Date(currentPeriodEndTimestamp * 1000);
        } else {
          throw new Error('No se pudo obtener la fecha de expiración de Stripe');
        }
      } catch (stripeError) {
        console.error('❌ [Cancel Subscription] Error con Stripe:', stripeError);
        return NextResponse.json(
          { error: 'No se pudo confirmar la cancelación en Stripe. Inténtalo de nuevo.' },
          { status: 502 }
        );
      }
    }

    // Verificar que la fecha sea válida
    if (!currentPeriodEndDate || isNaN(currentPeriodEndDate.getTime())) {
      return NextResponse.json(
        { error: 'No se pudo confirmar la fecha de cancelación' },
        { status: 502 }
      );
    }

    // Actualizar en Supabase que está marcada para cancelación
    await updateUserSubscription(userId, {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: currentPeriodEndDate,
    });

    return NextResponse.json({
      success: true,
      message: 'Suscripción programada para cancelación al final del período actual',
      cancelAt: currentPeriodEndDate,
    });

  } catch (error) {
    console.error('❌ [Cancel Subscription] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
