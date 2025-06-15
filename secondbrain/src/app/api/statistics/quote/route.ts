import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getEntriesByDateRange } from '@/lib/firebase-operations';
import { format, subDays } from 'date-fns';

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
    
    let instagramQuote = "La vida es un viaje de crecimiento constante, y cada día es una nueva oportunidad para ser una mejor versión de ti mismo.";
    
    if (weekEntries && weekEntries.length > 0) {
      const entriesText = weekEntries.map(entry => entry.content).join(' ').slice(0, 1000);

      const quotePrompt = `
        Basándote en las siguientes entradas de diario, crea una cita inspiracional que pueda compartirse en redes sociales.
        
        La cita debe:
        - Ser motivadora y positiva
        - Reflejar los temas o emociones del contenido sin ser demasiado específica
        - Ser aplicable de manera general
        - Tener máximo 2 líneas
        - No mencionar detalles personales específicos
        
        Contenido del diario:
        ${entriesText}
        
        Cita inspiracional:
      `;

      try {
        const quoteCompletion = await openai.chat.completions.create({
          model: "o4-mini-2025-04-16",
          messages: [
            { role: "system", content: "Eres un especialista en crear citas inspiracionales personalizadas." },
            { role: "user", content: quotePrompt }
          ]
        });

        instagramQuote = quoteCompletion.choices[0].message.content || instagramQuote;
      } catch (error) {
        console.error('Error generando cita inspiracional:', error);
      }
    }
    
    return NextResponse.json({ instagramQuote });

  } catch (error) {
    console.error('Error en API de cita inspiracional:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error al generar cita: ${errorMessage}` },
      { status: 500 }
    );
  }
}
