import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createUserProfile, getUserProfile, updateUserSubscription } from '@/lib/subscription-operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
});

export async function POST(req: NextRequest) {
  try {
    const { planType, userId, userEmail, displayName, successUrl, cancelUrl } = await req.json();

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
      payment_method_types: ['card'],
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
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/subscription`,
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
