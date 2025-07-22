import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateUserSubscription, getUserProfile } from '@/lib/subscription-operations';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

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
      // Intentar cancelar en Stripe si tenemos una suscripción real
      try {
        const canceledSubscription = await stripe.subscriptions.update(
          userSubscription.stripeSubscriptionId,
          {
            cancel_at_period_end: true,
          }
        );

        // Obtener la fecha de fin del período actual desde la suscripción cancelada
        const currentPeriodEndTimestamp = (canceledSubscription as any).current_period_end;
        
        if (currentPeriodEndTimestamp && currentPeriodEndTimestamp > 0) {
          currentPeriodEndDate = new Date(currentPeriodEndTimestamp * 1000);
        } else {
          throw new Error('No se pudo obtener la fecha de expiración de Stripe');
        }
      } catch (stripeError) {
        console.warn('⚠️ [Cancel Subscription] Error con Stripe:', stripeError);
        
        // En caso de error con Stripe, calcular fecha manualmente
        currentPeriodEndDate = new Date();
        currentPeriodEndDate.setMonth(currentPeriodEndDate.getMonth() + 1);
      }
    }

    // Verificar que la fecha sea válida
    if (!currentPeriodEndDate || isNaN(currentPeriodEndDate.getTime())) {
      // Fallback: un mes desde ahora
      currentPeriodEndDate = new Date();
      currentPeriodEndDate.setMonth(currentPeriodEndDate.getMonth() + 1);
    }

    // Actualizar en Firebase que está marcada para cancelación
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
