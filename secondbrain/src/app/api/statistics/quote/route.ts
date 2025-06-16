import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getDiaryEntriesByUserId } from '@/lib/firebase-operations';

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

    // Obtener todas las entradas del usuario
    const allEntries = await getDiaryEntriesByUserId(userId);
    
    let instagramQuote = "La vida es un viaje de crecimiento constante, y cada día es una nueva oportunidad para ser una mejor versión de ti mismo.";
    
    if (allEntries && allEntries.length > 0) {
      // Ordenar por fecha más reciente y tomar la primera
      const sortedEntries = allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestEntry = sortedEntries[0];
      
      const entryText = latestEntry.content.slice(0, 1000);

      const quotePrompt = `
        Basándote en esta entrada de diario más reciente, crea un texto breve y atractivo para compartir en redes sociales.
        
        INSTRUCCIONES:
        - Debe ser una reflexión, pensamiento o consejo inspirado en esta experiencia personal
        - Máximo 200 caracteres (perfecto para Twitter/X)
        - Lenguaje positivo, motivador y universal
        - No incluyas detalles personales específicos (nombres, lugares, etc.)
        - Debe sonar natural y humano, no forzado
        - Puede incluir emojis apropiados al final
        - Sin comillas ni formato de cita tradicional
        - Hazlo inspiracional pero conectado con el contenido de la entrada
        
        Entrada del diario:
        ${entryText}
        
        Texto para redes sociales (máximo 200 caracteres):
      `;

      try {
        const quoteCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
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
