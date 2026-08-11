import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getDiaryEntriesByUserId } from '@/lib/supabase-operations';

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
      Eres un experto en redes sociales y bienestar personal. Basándote en los siguientes textos de diario, crea una frase inspiradora y única para compartir en Instagram.

      🧠 INSTRUCCIONES:
      - Usa un tono natural, empático y motivador.
      - No repitas clichés ni frases genéricas.
      - No incluyas datos personales (lugares, nombres, etc.)
      - Que parezca escrita por una persona real, no IA.
      - Máximo 200 caracteres.
      - Puedes usar emojis sutiles si lo ves natural.
      - Inspira reflexión o conexión, no frases vacías.
      - El objetivo es que alguien diga: “Wow, esto me representa”.

      📝 Textos de diario recientes:
      ${entryText}

      Tu frase:
      `;

      try {
        const quoteCompletion = await openai.responses.create({
          model: "gpt-5-mini",
          input: `Eres un especialista en crear citas inspiracionales personalizadas.\n\n${quotePrompt}`,
          reasoning: { effort: "minimal" } as any,
          text: { verbosity: "low" } as any
        } as any);

        const quoteText = (quoteCompletion as any).output_text 
          || ((quoteCompletion as any).output?.[0]?.content?.[0]?.text) 
          || instagramQuote;
        instagramQuote = quoteText;
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
