import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuthenticatedUser } from '@/lib/api-auth';

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Interfaz para la solicitud de estilización
interface StylizeRequest {
  text: string;
  userId: string;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const user = await getAuthenticatedUser(token);

    // validar usuario
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extraemos y validamos los datos de la solicitud
    const body = await request.json();
    const { text, userId } = body as StylizeRequest;

    if (user.uid !== userId) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    if (!text || text.trim() === '') {
      return NextResponse.json(
        { error: 'No se proporcionó texto para estilizar' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Se requiere el ID del usuario' },
        { status: 400 }
      );
    }

    // Prompt para estilizar el texto del diario
    const stylizePrompt = `
      Eres un asistente especializado en mejorar la escritura de entradas de diario personal.
      
      Mejora el siguiente texto manteniendo:
      1. El SIGNIFICADO original
      2. La información personal y emocional
      3. El tono personal del diario
      4. Todos los nombres de personas mencionadas
      5. Todas las fechas y eventos específicos
      
      Mejora:
      1. La claridad y fluidez de la escritura
      2. La estructura y organización
      3. La gramática y ortografía
      4. El estilo narrativo manteniendo la autenticidad
      
      IMPORTANTE: 
      - NO agregues información que no esté en el texto original
      - NO cambies nombres de personas
      - NO cambies fechas o eventos
      - Mantén el estilo personal y emocional del autor
      
      Texto a mejorar:
      ${text}
      
      Responde SOLO con el texto mejorado, sin explicaciones adicionales.
    `;

    // Llamada a OpenAI para estilizar el texto
    const stylizeCompletion = await openai.chat.completions.create({
      model: "o4-mini-2025-04-16",
      messages: [
        { role: "system", content: "Eres un asistente especializado en mejorar la escritura de diarios personales." },
        { role: "user", content: stylizePrompt }
      ],
      temperature: 0.7
    });

    const stylizedText = stylizeCompletion.choices[0].message.content || text;

    return NextResponse.json({ 
      stylizedText,
      message: 'Texto estilizado correctamente'
    });
  } catch (error) {
    console.error('Error en API de estilización:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error al procesar la solicitud: ${errorMessage}` },
      { status: 500 }
    );
  }
}
