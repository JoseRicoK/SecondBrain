import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(req: NextRequest) {
  try {
    // Verificar que la petición venga de una fuente autorizada
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Si hay un secreto configurado, verificarlo
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // En producción, solo permitir desde Vercel Cron o GitHub Actions
      const allowedOrigins = [
        'vercel.com', 
        'github.com',
        process.env.VERCEL_URL,
        process.env.NEXT_PUBLIC_VERCEL_URL
      ].filter(Boolean);
      
      const origin = req.headers.get('origin') || req.headers.get('referer') || '';
      const isAuthorized = allowedOrigins.some(allowed => allowed && origin.includes(allowed));
      
      if (!isAuthorized) {
        return NextResponse.json(
          { error: 'No autorizado' },
          { status: 401 }
        );
      }
    }

    console.log('🔄 [Expire Subscriptions] Iniciando verificación de suscripciones expiradas');

    const now = new Date();
    
    // Buscar todas las suscripciones que están marcadas para cancelar y cuyo período ha expirado
    const usersRef = collection(db, 'users');
    const expiredQuery = query(
      usersRef, 
      where('subscription.cancelAtPeriodEnd', '==', true),
      where('subscription.status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(expiredQuery);
    let processedCount = 0;
    let expiredCount = 0;

    for (const userDoc of querySnapshot.docs) {
      const userData = userDoc.data();
      const subscription = userData.subscription;
      
      processedCount++;
      
      if (subscription?.currentPeriodEnd) {
        // Convertir la fecha almacenada a Date object
        const periodEndDate = subscription.currentPeriodEnd.toDate ? 
          subscription.currentPeriodEnd.toDate() : 
          new Date(subscription.currentPeriodEnd);
        
        // Si la fecha de fin del período ya pasó, cambiar a plan gratuito
        if (periodEndDate <= now) {
          console.log(`⏰ [Expire Subscriptions] Expirando suscripción para usuario: ${userDoc.id}`);
          
          const userRef = doc(db, 'users', userDoc.id);
          await updateDoc(userRef, {
            'subscription.plan': 'free',
            'subscription.status': 'canceled',
            'subscription.cancelAtPeriodEnd': false,
            'subscription.stripeCustomerId': null,
            'subscription.stripeSubscriptionId': null,
            'subscription.updatedAt': now
          });
          
          expiredCount++;
          console.log(`✅ [Expire Subscriptions] Usuario ${userDoc.id} cambiado a plan gratuito`);
        } else {
          console.log(`⏳ [Expire Subscriptions] Usuario ${userDoc.id} aún activo hasta: ${periodEndDate.toLocaleDateString('es-ES')}`);
        }
      }
    }

    console.log(`✅ [Expire Subscriptions] Proceso completado. Procesados: ${processedCount}, Expirados: ${expiredCount}`);

    return NextResponse.json({
      success: true,
      message: `Proceso completado exitosamente`,
      processed: processedCount,
      expired: expiredCount,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('❌ [Expire Subscriptions] Error:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

// Método GET para permitir llamadas desde cron jobs externos
export async function GET() {
  // Redirigir al método POST
  return POST(new NextRequest('http://localhost/api/subscription/expire-subscriptions', { method: 'POST' }));
}
