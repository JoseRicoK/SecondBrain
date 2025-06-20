import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Person } from '@/lib/firebase-operations';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { canSendPersonChatMessage } from '@/middleware/subscription';
import { getUserMonthlyUsage, incrementPersonChatUsage } from '@/lib/subscription-operations';

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

    const { person, message, conversationHistory, currentDate } = await request.json();

    if (!person || !message) {
      return NextResponse.json(
        { error: 'Se requiere la información de la persona y el mensaje' },
        { status: 400 }
      );
    }

    // Verificar límites de chat con personas
    const monthlyUsage = await getUserMonthlyUsage(user.uid);
    const canSendMessage = await canSendPersonChatMessage(user.uid, monthlyUsage.personChatMessages);
    
    if (!canSendMessage) {
      return NextResponse.json(
        { 
          error: 'Límite de mensajes de chat con personas alcanzado para este mes',
          code: 'LIMIT_EXCEEDED',
          currentUsage: monthlyUsage.personChatMessages
        },
        { status: 429 }
      );
    }

    console.log('Chat person request - Current date:', currentDate);

    // Construir el contexto de la persona
    const personContext = buildPersonContext(person);

    // Preparar los mensajes para la conversación
    const messages = [
      {
        role: 'system' as const,
        content: `Eres un asistente inteligente especializado en análisis de datos personales y relaciones humanas. Tu objetivo es ayudar a analizar y responder preguntas sobre una persona específica basándote en la información recopilada sobre ella a lo largo del tiempo.

FECHA Y HORA ACTUAL (España): ${currentDate || 'No disponible'}

INFORMACIÓN DE LA PERSONA:
${personContext}

CAPACIDADES ESPECIALES:
- Analiza patrones temporales en la información registrada
- Identifica cambios y evoluciones en las relaciones
- Detecta gaps de información importantes
- Proporciona insights sobre la dinámica relacional
- Sugiere preguntas relevantes para profundizar el conocimiento
- Puede responder sobre eventos relativos como "ayer", "la semana pasada", etc.

INSTRUCCIONES:
- Responde únicamente basándote en la información proporcionada sobre esta persona
- Utiliza tu capacidad de análisis para identificar patrones, tendencias y conexiones
- Cuando se pregunte sobre fechas relativas (ayer, anteayer, etc.), usa la fecha actual para calcular
- Si detectas información contradictoria o evolutiva, analízala en contexto temporal
- Cuando no tengas información suficiente, sé específico sobre qué datos serían valiosos
- Proporciona análisis profundos pero concisos
- Mantén un enfoque analítico pero humano y empático
- Responde en español con un tono profesional pero cercano
- Aprovecha al máximo la información temporal para generar insights`
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
      max_tokens: 2000, // Aumentado para aprovechar mejor las capacidades del modelo
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error('No se recibió respuesta del modelo');
    }

    // Incrementar contador de uso solo si fue exitoso
    await incrementPersonChatUsage(user.uid);

    return NextResponse.json({
      response,
      personName: person.name
    });

  } catch (error) {
    console.error('Error en chat con persona:', error);
    
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

// Función auxiliar para construir el contexto de la persona
function buildPersonContext(person: Person): string {
  let context = `NOMBRE: ${person.name}\n\n`;

  if (person.details && Object.keys(person.details).length > 0) {
    context += "INFORMACIÓN CONOCIDA:\n";
    
    Object.entries(person.details).forEach(([category, value]) => {
      context += `\n${category.toUpperCase()}:\n`;
      
      // Manejar tanto el formato nuevo con fechas como el antiguo
      if (typeof value === 'object' && value !== null && 'entries' in value) {
        // Nuevo formato con fechas
        const categoryData = value as { entries: Array<{ value: string; date: string }> };
        categoryData.entries
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .forEach(entry => {
            const date = new Date(entry.date).toLocaleDateString('es-ES');
            context += `- ${entry.value} (registrado el ${date})\n`;
          });
      } else if (Array.isArray(value)) {
        // Formato antiguo con arrays
        (value as string[]).forEach(item => {
          context += `- ${item}\n`;
        });
      } else if (typeof value === 'string') {
        // Formato antiguo con strings
        context += `- ${value}\n`;
      }
    });
  } else {
    context += "No hay información adicional disponible sobre esta persona.";
  }

  return context;
}
