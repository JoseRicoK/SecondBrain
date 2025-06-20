import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Devolver los plan IDs desde las variables de entorno del servidor
    const planIds = {
      basic: process.env.STRIPE_BASIC_PRICE_ID || 'price_basic_monthly',
      pro: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly', 
      elite: process.env.STRIPE_ELITE_PRICE_ID || 'price_elite_monthly'
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