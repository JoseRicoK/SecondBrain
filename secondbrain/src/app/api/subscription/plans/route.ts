import { NextResponse } from 'next/server';
import { isCheckoutEnabled } from '@/lib/stripe-server';

export async function GET() {
  try {
    const planIds = {
      free: null,
      pro: process.env.STRIPE_PRO_PRICE_ID || null,
      elite: process.env.STRIPE_ELITE_PRICE_ID || null,
      checkoutEnabled: isCheckoutEnabled(),
    };

    return NextResponse.json(planIds);
  } catch (error) {
    console.error('Error al obtener plan IDs:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
