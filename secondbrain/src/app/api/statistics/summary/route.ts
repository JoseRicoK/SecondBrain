import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getEntriesByDateRange } from '@/lib/firebase-operations';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

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

    const userId = user.uid;
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);

    // Obtener entradas de los últimos 7 días
    const weekEntries = await getEntriesByDateRange(userId, format(sevenDaysAgo, 'yyyy-MM-dd'), format(now, 'yyyy-MM-dd'));
    
    let weekSummary = "No hay entradas suficientes para generar un resumen de la semana.";
    
    if (weekEntries && weekEntries.length > 0) {
      const entriesText = weekEntries.map(entry => 
        `${format(new Date(entry.date), "EEEE d 'de' MMMM", { locale: es })}: ${entry.content}`
      ).join('\n\n');

      const summaryPrompt = `
        Crea un resumen conciso y fluido de la semana basado en las siguientes entradas de diario de los últimos 7 días.
        
        INSTRUCCIONES IMPORTANTES:
        - Máximo 120 palabras
        - Texto corrido EN PÁRRAFO ÚNICO, sin listas, numeraciones, viñetas o secciones
        - NO uses estructuras como "1. Eventos importantes" o "• Celebraciones"
        - Enfoque positivo y motivador
        - Incluye eventos principales, emociones y relaciones importantes en un texto fluido
        - Termina con una perspectiva optimista para la semana que viene
        - Escribe en segunda persona (tú/tu)
        - Evita ser repetitivo o redundante
        
        Entradas del diario:
        ${entriesText}
        
        Resumen fluido de la semana (máximo 120 palabras en párrafo único):
      `;

      try {
        const summaryCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Eres un asistente especializado en análisis de diarios personales y desarrollo personal." },
            { role: "user", content: summaryPrompt }
          ]
        });

        weekSummary = summaryCompletion.choices[0].message.content || weekSummary;
      } catch (error) {
        console.error('Error generando resumen semanal:', error);
      }
    }
    
    return NextResponse.json({ weekSummary });

  } catch (error) {
    console.error('Error en API de resumen semanal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error al generar resumen: ${errorMessage}` },
      { status: 500 }
    );
  }
}
