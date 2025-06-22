import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getEntriesMoodDataByDateRange } from '@/lib/firebase-operations';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const user = await getAuthenticatedUser(token);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const moodPeriod = (url.searchParams.get('moodPeriod') || 'week') as 'week' | 'month' | 'year';
    const userId = user.uid;
    const now = new Date();

    // Calcular rango de fechas según el periodo
    let startDate: Date;
    let endDate: Date;

    switch (moodPeriod) {
      case 'week':
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
    }

    // Obtener datos de estado de ánimo directamente de las entradas del diario
    const entriesMoodData = await getEntriesMoodDataByDateRange(
      userId, 
      format(startDate, 'yyyy-MM-dd'), 
      format(endDate, 'yyyy-MM-dd')
    );

    let moodData: Array<{
      date: string;
      stress: number;
      happiness: number;
      tranquility: number;
      sadness: number;
    }> = [];

    if (entriesMoodData && entriesMoodData.length > 0) {
      // Calcular promedios de todo el periodo
      const totalEntries = entriesMoodData.length;
      const averageStress = Math.round(
        entriesMoodData.reduce((sum, entry) => sum + entry.stress, 0) / totalEntries
      );
      const averageHappiness = Math.round(
        entriesMoodData.reduce((sum, entry) => sum + entry.happiness, 0) / totalEntries
      );
      const averageTranquility = Math.round(
        entriesMoodData.reduce((sum, entry) => sum + entry.tranquility, 0) / totalEntries
      );
      const averageSadness = Math.round(
        entriesMoodData.reduce((sum, entry) => sum + entry.sadness, 0) / totalEntries
      );

      moodData = [{
        date: format(now, 'yyyy-MM-dd'),
        stress: averageStress,
        happiness: averageHappiness,
        tranquility: averageTranquility,
        sadness: averageSadness
      }];
    } else {
      // Si no hay datos analizados, devolver valores neutros
      moodData = [{
        date: format(now, 'yyyy-MM-dd'),
        stress: 0,
        happiness: 0,
        tranquility: 50,
        sadness: 0
      }];
    }
    
    return NextResponse.json({ moodData });

  } catch (error) {
    console.error('Error en API de datos de estado de ánimo:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error al obtener datos de estado de ánimo: ${errorMessage}` },
      { status: 500 }
    );
  }
}
