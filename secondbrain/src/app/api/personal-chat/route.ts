import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getDiaryEntriesByUserId } from '@/lib/firebase-operations';
import { getAuthenticatedUser } from '@/lib/api-auth';

// Configurar OpenAI con GPT-4.1 mini
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const user = await getAuthenticatedUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, message, conversationHistory, userName, currentDate } = await request.json();
    if (user.uid !== userId) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    if (!userId || !message) {
      return NextResponse.json(
        { error: 'Se requiere el ID de usuario y el mensaje' },
        { status: 400 }
      );
    }

    // Get user display name from frontend
    const userDisplayName = userName || 'Usuario';
    
    console.log('Personal chat request - User name:', userDisplayName);
    console.log('Personal chat request - Current date:', currentDate);

    // Obtener todas las entradas del diario del usuario
    const diaryEntries = await getDiaryEntriesByUserId(userId);
    
    // Construir el contexto del usuario con todas sus entradas
    const userContext = buildUserContext(diaryEntries, userId, { name: userDisplayName, email: null });
    const messages = [
      {
        role: 'system' as const,
        content: `Eres un asistente personal inteligente especializado en análisis de vida personal y crecimiento personal. Estás ayudando a ${userName} a analizar, reflexionar y obtener insights sobre su vida basándote en todas las entradas de su diario personal.

FECHA Y HORA ACTUAL (España): ${currentDate || 'No disponible'}

${userContext}

CAPACIDADES ESPECIALES:
- Analiza patrones temporales en la vida de ${userName}
- Identifica tendencias emocionales y de comportamiento
- Detecta temas recurrentes y preocupaciones
- Proporciona insights sobre relaciones y actividades
- Sugiere reflexiones y preguntas para el crecimiento personal
- Conecta eventos y experiencias a lo largo del tiempo
- Ayuda a identificar logros y áreas de mejora
- Puede responder sobre eventos relativos como "ayer", "la semana pasada", etc.

INSTRUCCIONES:
- Dirígete a la persona por su nombre (${userName}) de manera natural y personal
- Responde basándote únicamente en la información del diario proporcionada
- Utiliza tu capacidad de análisis para identificar patrones, tendencias y conexiones temporales
- Cuando se pregunte sobre fechas relativas (ayer, anteayer, etc.), usa la fecha actual para calcular
- Sé empático, comprensivo y orientado al crecimiento personal
- Proporciona análisis profundos pero accesibles y útiles
- Cuando detectes patrones emocionales, menciónalos con tacto
- Sugiere reflexiones constructivas y preguntas que fomenten el autoconocimiento
- Mantén un tono personal, cálido pero profesional
- Responde en español
- Si no tienes información suficiente sobre algo específico, sugiere qué sería útil registrar
- Aprovecha la información temporal para mostrar evolución y cambios
- Haz referencias específicas a eventos y fechas del diario cuando sea relevante`
      },
      // Incluir historial de conversación si existe
      ...(conversationHistory || []),
      {
        role: 'user' as const,
        content: message
      }
    ];

    // Llamar a la API de OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14', // GPT-4.1 mini más reciente - optimizado para grandes cantidades de datos
      messages: messages,
      max_tokens: 2500, // Aumentado para análisis más profundos de vida personal
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error('No se recibió respuesta del modelo');
    }

    return NextResponse.json({
      response,
      entriesAnalyzed: diaryEntries.length,
      userName: userDisplayName
    });

  } catch (error) {
    console.error('Error en chat personal:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Error del chat: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función auxiliar para construir el contexto del usuario
function buildUserContext(
  diaryEntries: Array<{
    id: string;
    content: string;
    created_at: string;
    title?: string;
    mood?: string;
    tags?: string[];
    mentioned_people?: string[];
  }>, 
  userId: string,
  userInfo: { name: string; email: string | null }
): string {
  const userName = userInfo.name;
  let context = `CONTEXTO DEL USUARIO:\n`;
  context += `- Nombre: ${userName}\n`;
  context += `- ID: ${userId}\n\n`;
  
  if (diaryEntries.length === 0) {
    context += "No hay entradas de diario disponibles para analizar.";
    return context;
  }

  context += `RESUMEN GENERAL:\n`;
  context += `- Total de entradas analizadas: ${diaryEntries.length}\n`;
  
  // Ordenar entradas por fecha (más reciente primero)
  const sortedEntries = diaryEntries.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Obtener rango de fechas
  const firstEntry = sortedEntries[sortedEntries.length - 1];
  const lastEntry = sortedEntries[0];
  const firstDate = new Date(firstEntry.created_at).toLocaleDateString('es-ES');
  const lastDate = new Date(lastEntry.created_at).toLocaleDateString('es-ES');
  
  context += `- Período cubierto: desde ${firstDate} hasta ${lastDate}\n\n`;

  context += `ENTRADAS DEL DIARIO (ordenadas por fecha, más recientes primero):\n\n`;

  // Incluir las entradas más recientes (limitamos para no exceder el contexto)
  const maxEntries = 50; // Limitar el número de entradas para no exceder el contexto
  const entriesToInclude = sortedEntries.slice(0, maxEntries);

  entriesToInclude.forEach((entry, index) => {
    const date = new Date(entry.created_at).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    context += `${index + 1}. FECHA: ${date}\n`;
    if (entry.content && entry.content.trim()) {
      context += `   CONTENIDO: ${entry.content.trim()}\n`;
    }
    if (entry.mentioned_people && entry.mentioned_people.length > 0) {
      context += `   PERSONAS MENCIONADAS: ${entry.mentioned_people.join(', ')}\n`;
    }
    context += `\n`;
  });

  if (sortedEntries.length > maxEntries) {
    context += `... y ${sortedEntries.length - maxEntries} entradas más antiguas no mostradas por límites de contexto.\n`;
  }

  return context;
}
