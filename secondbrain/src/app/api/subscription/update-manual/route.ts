import { NextRequest, NextResponse } from 'next/server';
import { updateUserSubscription } from '@/lib/subscription-operations';

export async function POST(req: NextRequest) {
  try {
    const { userId, planType } = await req.json();

    if (!userId || !planType) {
      return NextResponse.json(
        { error: 'Missing userId or planType' },
        { status: 400 }
      );
    }

    if (!['basic', 'pro', 'elite'].includes(planType)) {
      return NextResponse.json(
        { error: 'Invalid plan type' },
        { status: 400 }
      );
    }

    console.log('🔧 [Manual Update] Actualizando suscripción manualmente:', { userId, planType });

    await updateUserSubscription(userId, {
      plan: planType as 'basic' | 'pro' | 'elite',
      status: 'active',
      // No incluimos datos de Stripe ya que es una actualización manual
    });

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
