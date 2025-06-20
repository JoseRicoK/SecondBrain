import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { canAccessStatistics } from '@/middleware/subscription';
import { getUserMonthlyUsage, incrementStatisticsAccess } from '@/lib/subscription-operations';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const user = await getAuthenticatedUser(token);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await request.json();
    if (user.uid !== userId) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    // Verificar límites de acceso a estadísticas
    const monthlyUsage = await getUserMonthlyUsage(userId);
    const canAccess = await canAccessStatistics(userId, monthlyUsage.statisticsAccess);
    
    if (!canAccess) {
      return NextResponse.json(
        { 
          error: 'Límite de acceso a estadísticas alcanzado para este mes',
          code: 'STATISTICS_LIMIT_EXCEEDED',
          currentUsage: monthlyUsage.statisticsAccess,
          canAccess: false
        },
        { status: 429 }
      );
    }

    // Incrementar contador de acceso
    await incrementStatisticsAccess(userId);

    return NextResponse.json({
      success: true,
      canAccess: true,
      currentUsage: monthlyUsage.statisticsAccess + 1
    });

  } catch (error) {
    console.error('❌ [Statistics Access] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
