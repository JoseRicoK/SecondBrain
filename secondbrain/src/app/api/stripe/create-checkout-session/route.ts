import { NextRequest, NextResponse } from 'next/server';
import { createUserProfile, getUserProfile, updateUserSubscription } from '@/lib/subscription-operations';
import { getRequestUser } from '@/lib/api-auth';
import { getStripeClient, isCheckoutEnabled } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!isCheckoutEnabled()) {
      return NextResponse.json({ error: 'Los pagos todavía no están disponibles' }, { status: 503 });
    }
    const stripe = getStripeClient();
    if (!stripe) return NextResponse.json({ error: 'Los pagos todavía no están disponibles' }, { status: 503 });
    const user = await getRequestUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { planType, userId, userEmail, displayName, successUrl, cancelUrl } = await req.json();
    if (user.uid !== userId || user.email?.toLowerCase() !== String(userEmail).toLowerCase()) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }
    void successUrl; void cancelUrl;

    if (!planType || !userId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log('🎯 Creando sesión de checkout para:', {
      planType,
      userId,
      userEmail,
      displayName
    });

    // Crear o actualizar el perfil del usuario en Supabase
    try {
      await createUserProfile(userId, {
        email: userEmail,
        displayName: displayName || userEmail.split('@')[0],
        isGoogleUser: false, // Se puede ajustar según el método de auth
      });
    } catch (profileError) {
      console.error('⚠️ Error creando perfil de usuario (continuando con checkout):', profileError);
    }

    // Mapear tipos de plan a Price IDs
    const priceIdMap = {
      pro: process.env.STRIPE_PRO_PRICE_ID,
      elite: process.env.STRIPE_ELITE_PRICE_ID,
    };

    const priceId = priceIdMap[planType as keyof typeof priceIdMap];
    
    if (!priceId) {
      console.error('Price ID no encontrado para plan:', planType);
      console.error('Variables de entorno disponibles:', {
        pro: process.env.STRIPE_PRO_PRICE_ID,
        elite: process.env.STRIPE_ELITE_PRICE_ID,
      });
      return NextResponse.json(
        { error: 'Invalid plan type' },
        { status: 400 }
      );
    }

    // Asegurar que el Customer de Stripe existe y reutilizarlo
    let customerId: string | undefined;
    try {
      const profile = await getUserProfile(userId);
      customerId = profile?.subscription?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { uid: userId, display_name: displayName || userEmail.split('@')[0] },
        });
        customerId = customer.id;
        // Guardar el customerId en el perfil para futuras operaciones
        await updateUserSubscription(userId, { stripeCustomerId: customerId });
      }
    } catch (customerErr) {
      console.warn('⚠️ No se pudo asegurar/crear el Customer en Stripe. Continuando con customer_email.', customerErr);
    }

    // Crear la sesión de checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...(customerId ? { customer: customerId } : { customer_email: userEmail }),
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
    });

    console.log('✅ Sesión de checkout creada:', session.id);
    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Error creating checkout session' },
      { status: 500 }
    );
  }
}
