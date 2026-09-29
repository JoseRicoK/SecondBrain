import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile, updateUserSubscription } from '@/lib/subscription-operations';
import { getRequestUser } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, planType, clearCancellation } = await req.json();
    if (userId !== user.uid) return NextResponse.json({ error: 'User mismatch' }, { status: 403 });

    if (!userId || !planType) {
      return NextResponse.json(
        { error: 'Missing userId or planType' },
        { status: 400 }
      );
    }

    if (planType !== 'free') {
      return NextResponse.json(
        { error: 'Invalid plan type' },
        { status: 400 }
      );
    }

    const current = await getUserProfile(userId);
    if (!current) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    const periodEnd = current.subscription.currentPeriodEnd;
    const expired = periodEnd && new Date(periodEnd) <= new Date();
    if (current.subscription.status === 'active' && current.subscription.plan !== 'free' &&
        !(current.subscription.cancelAtPeriodEnd && expired)) {
      return NextResponse.json({ error: 'La suscripción activa debe cancelarse desde Stripe' }, { status: 409 });
    }
    const updateData = { plan: 'free' as const, status: 'inactive' as const,
      cancelAtPeriodEnd: false, currentPeriodEnd: undefined as Date | undefined,
      stripeCustomerId: undefined as string | undefined, stripeSubscriptionId: undefined as string | undefined };

    // Si se solicita limpiar la cancelación (para suscripciones expiradas)
    void clearCancellation;

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
