import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getEntriesMoodDataByDateRange } from '@/lib/supabase-operations';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

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
        // Calcular los últimos 7 días (hoy + 6 días hacia atrás)
        endDate = now; // Hasta hoy
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6); // 6 días hacia atrás = 7 días en total
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

    console.log(`🔍 [Mood API] Periodo: ${moodPeriod}`);
    console.log(`🔍 [Mood API] Rango de fechas: ${format(startDate, 'yyyy-MM-dd')} a ${format(endDate, 'yyyy-MM-dd')}`);
    console.log(`🔍 [Mood API] Datos encontrados:`, entriesMoodData.length, 'entradas');
    console.log(`🔍 [Mood API] Datos completos:`, JSON.stringify(entriesMoodData, null, 2));

    let moodData: Array<{
      date: string;
      stress: number;
      happiness: number;
      tranquility: number;
      sadness: number;
    }> = [];

    if (entriesMoodData && entriesMoodData.length > 0) {
      console.log(`🔍 [Mood API] Procesando ${entriesMoodData.length} entradas encontradas`);
      
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

      console.log(`🔍 [Mood API] Promedios calculados:`, {
        stress: averageStress,
        happiness: averageHappiness,
        tranquility: averageTranquility,
        sadness: averageSadness
      });

      // Devolver el array completo de entradas ordenadas por fecha
      moodData = entriesMoodData.sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
    } else {
      console.log(`❌ [Mood API] No se encontraron datos para el periodo ${moodPeriod} (${format(startDate, 'yyyy-MM-dd')} - ${format(endDate, 'yyyy-MM-dd')})`);
      
      // Si no hay datos, devolver array vacío - NO valores por defecto
      moodData = [];
    }
    
    console.log(`🔍 [Mood API] Respuesta final:`, JSON.stringify({ moodData }, null, 2));
    
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
