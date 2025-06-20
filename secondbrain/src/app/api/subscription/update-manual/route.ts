import { NextRequest, NextResponse } from 'next/server';
import { updateUserSubscription } from '@/lib/subscription-operations';

export async function POST(req: NextRequest) {
  try {
    const { userId, planType, clearCancellation } = await req.json();

    if (!userId || !planType) {
      return NextResponse.json(
        { error: 'Missing userId or planType' },
        { status: 400 }
      );
    }

    if (!['free', 'pro', 'elite'].includes(planType)) {
      return NextResponse.json(
        { error: 'Invalid plan type' },
        { status: 400 }
      );
    }

    console.log('🔧 [Manual Update] Actualizando suscripción manualmente:', { userId, planType, clearCancellation });

    const updateData: any = {
      plan: planType as 'free' | 'pro' | 'elite',
      status: planType === 'free' ? 'inactive' : 'active',
    };

    // Si se solicita limpiar la cancelación (para suscripciones expiradas)
    if (clearCancellation) {
      updateData.cancelAtPeriodEnd = false;
      updateData.currentPeriodEnd = null;
      updateData.stripeCustomerId = null;
      updateData.stripeSubscriptionId = null;
    }

    await updateUserSubscription(userId, updateData);

    console.log('✅ [Manual Update] Suscripción actualizada manualmente');

    return NextResponse.json({ success: true, message: 'Suscripción actualizada correctamente' });
  } catch (error) {
    console.error('❌ [Manual Update] Error actualizando suscripción:', error);
    return NextResponse.json(
      { error: 'Error updating subscription' },
      { status: 500 }
    );
  }
}
