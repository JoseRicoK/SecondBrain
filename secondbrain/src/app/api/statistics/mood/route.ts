import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getEntriesByDateRange, saveMoodData, getMoodDataByPeriod } from '@/lib/firebase-operations';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    let moodData: any[] = [];

    // Intentar obtener datos de estado de ánimo existentes
    try {
      moodData = await getMoodDataByPeriod(userId, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'));
    } catch (error) {
      console.error('Error obteniendo datos de estado de ánimo:', error);
      moodData = [];
    }

    // Si no hay datos, analizar y generar
    if (!moodData || moodData.length === 0) {
      const periodEntries = await getEntriesByDateRange(userId, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'));
      
      if (periodEntries && periodEntries.length > 0) {
        const allText = periodEntries.map(entry => entry.content).join(' ');
        
        const moodAnalysisPrompt = `
          Analiza el siguiente texto de entradas de diario y asigna porcentajes de estado de ánimo.
          Los porcentajes deben sumar exactamente 100.
          
          Categorías:
          - Estrés: Ansiedad, presión, preocupaciones, tensión
          - Felicidad: Alegría, satisfacción, logros, momentos positivos
          - Neutral: Estados equilibrados, actividades rutinarias, pensamientos neutros
          
          Texto a analizar:
          ${allText.slice(0, 2000)}
          
          Responde SOLO con un objeto JSON en este formato exacto:
          {"stress": 25, "happiness": 60, "neutral": 15}
          
          Asegúrate de que los números sumen exactamente 100.
        `;

        try {
          const moodCompletion = await openai.chat.completions.create({
            model: "o4-mini-2025-04-16",
            messages: [
              { role: "system", content: "Eres un experto en análisis de estados de ánimo en textos." },
              { role: "user", content: moodAnalysisPrompt }
            ],
            response_format: { type: "json_object" }
          });

          const moodAnalysis = JSON.parse(moodCompletion.choices[0].message.content || '{"stress": 20, "happiness": 50, "neutral": 30}');
          
          // Normalizar para que sume 100
          const total = moodAnalysis.stress + moodAnalysis.happiness + moodAnalysis.neutral;
          if (total !== 100) {
            moodAnalysis.stress = Math.round((moodAnalysis.stress / total) * 100);
            moodAnalysis.happiness = Math.round((moodAnalysis.happiness / total) * 100);
            moodAnalysis.neutral = 100 - moodAnalysis.stress - moodAnalysis.happiness;
          }

          moodData = [{
            date: format(now, 'yyyy-MM-dd'),
            stress: moodAnalysis.stress,
            happiness: moodAnalysis.happiness,
            neutral: moodAnalysis.neutral
          }];

          // Guardar los datos analizados
          try {
            await saveMoodData({
              user_id: userId,
              date: format(now, 'yyyy-MM-dd'),
              stress_level: moodAnalysis.stress,
              happiness_level: moodAnalysis.happiness,
              neutral_level: moodAnalysis.neutral,
              analysis_summary: 'Análisis automático'
            });
          } catch (saveError) {
            console.error('Error guardando datos de estado de ánimo:', saveError);
          }
        } catch (error) {
          console.error('Error analizando estado de ánimo:', error);
          moodData = [{
            date: format(now, 'yyyy-MM-dd'),
            stress: 20,
            happiness: 50,
            neutral: 30
          }];
        }
      } else {
        moodData = [{
          date: format(now, 'yyyy-MM-dd'),
          stress: 0,
          happiness: 0,
          neutral: 100
        }];
      }
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
