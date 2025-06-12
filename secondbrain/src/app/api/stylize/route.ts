import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { isValidUUID, getPeopleByUserId, Person, PersonDetailCategory, saveExtractedPersonInfo } from '@/lib/firebase-operations';
import { v5 as uuidv5 } from 'uuid';

// Namespace para generar UUIDs determinísticos (este es un UUID arbitrario)
const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

// Función para generar un UUID determinístico a partir de un string
function generateUUID(input: string): string {
  return uuidv5(input, NAMESPACE);
}

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Interfaz para la solicitud de estilización
interface StylizeRequest {
  text: string;
  userId: string; // Aseguramos que esto sea requerido
  extractPeople?: boolean;
  entryDate?: string; // Fecha de la entrada del diario para añadir a los detalles
}

interface PersonExtracted {
  name: string;
  information: Record<string, unknown>;
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
    const { text, userId, extractPeople = true, entryDate } = body as StylizeRequest;

    if (user.uid !== userId) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    // Asegurar que siempre tenemos una fecha válida
    const validEntryDate = entryDate || new Date().toISOString().split('T')[0];

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

    // 1. Estilizar el texto
    const stylizePrompt = `
      Eres un asistente especializado en mejorar y estilizar textos. 
      Tu tarea es tomar el texto transcrito de una grabación de voz y convertirlo en un texto bien escrito y estructurado.
      
      Instrucciones específicas:
      1. Mantén el contenido y las ideas originales, pero mejora la redacción y estructura.
      2. Corrige errores gramaticales y de puntuación.
      3. Organiza el texto en párrafos coherentes si es necesario.
      4. Elimina muletillas, repeticiones y palabras de relleno típicas del habla.
      5. No añadas información que no esté en el texto original.
      6. Respeta el estilo y personalidad del autor.
      
      Texto a estilizar:
      ${text}
      
      Responde SOLO con el texto estilizado, sin comentarios adicionales.
    `;

    const stylizeCompletion = await openai.chat.completions.create({
      model: "o4-mini-2025-04-16",  // Modelo más económico que gpt-4o pero con buen rendimiento
      messages: [
        { role: "system", content: "Eres un asistente especializado en mejorar y estilizar entradas de diario." },
        { role: "user", content: stylizePrompt }
      ]
      // temperatura predeterminada (1) para compatibilidad con o4-mini
    });

    const stylizedText = stylizeCompletion.choices[0].message.content;
    
    // 2. Extraer información sobre personas mencionadas (si se solicita)
    let peopleExtracted: PersonExtracted[] = [];
    
    if (extractPeople) {
      // Convertir userId a UUID válido para la consulta
      const validUUID = isValidUUID(userId) ? userId : generateUUID(userId);
      
      // 2.1 Obtener personas existentes de la base de datos para proporcionar contexto
      const existingPeople = await getPeopleByUserId(validUUID);
      
      // Crear una lista simple de nombres conocidos para el prompt
      let knownNames: string[] = [];
      if (existingPeople && existingPeople.length > 0) {
        knownNames = existingPeople.map((person: Person) => person.name);
      }
      
      // Log temporal para debug - remover en producción
      console.log('🔍 [API Stylize] Nombres conocidos:', knownNames);
      
      const extractPrompt = `
        Analiza el siguiente texto y extrae información sobre las personas mencionadas en él.
        
        ${knownNames.length > 0 ? `Personas que ya conozco: ${knownNames.join(', ')}` : 'No tengo información previa sobre ninguna persona.'}
        
        Instrucciones para la extracción de personas:

        1. SOLO incluye personas que se mencionan EXPLÍCITAMENTE en el texto actual
        2. SOLO incluye información que se menciona EXPLÍCITAMENTE en el texto actual
        3. NO incluyas información que no esté mencionada en el texto

        4. DEFINICIÓN DE CAMPOS:
           - 'rol': SOLO si el texto menciona una ocupación o profesión (estudiante, médico, ingeniero, etc.)
           - 'relacion': SOLO si el texto menciona una relación contigo (amigo, madre, pareja, hermano, etc.)
           - 'detalles': Eventos, actividades o hechos mencionados sobre la persona

        5. Si una persona conocida se menciona pero no se dice nueva información sobre ella, NO la incluyas en la respuesta

        6. Si el texto dice "mi madre" o "mi hermana" pero ya conoces el nombre de esa persona, usa el nombre conocido

        EJEMPLOS:
        
        Texto: "Vero tiene examen mañana"
        Persona conocida: Vero
        Respuesta: {"people": [{"name": "Vero", "information": {"detalles": ["tiene examen mañana"]}}]}
        
        Texto: "Hablé con Vero"
        Persona conocida: Vero
        Respuesta: {"people": []} (porque no se menciona información nueva)
        
        Texto: "Conocí a Juan, es médico"
        Personas conocidas: Vero
        Respuesta: {"people": [{"name": "Juan", "information": {"rol": "médico"}}]}
        
        Texto a analizar:
        ${text}
        
        Responde con un objeto JSON con esta estructura exacta:
        {
          "people": [
            {
              "name": "Nombre completo",
              "information": {
                "rol": "OPCIONAL - Solo si se menciona ocupación",
                "relacion": "OPCIONAL - Solo si se menciona relación",
                "detalles": [
                  "Solo información nueva mencionada en el texto"
                ]
              }
            }
          ]
        }
        
        Si no hay personas mencionadas con información nueva, devuelve: {"people": []}
        Responde SOLO con el JSON, sin explicaciones.
      `;

      const extractCompletion = await openai.chat.completions.create({
        model: "o4-mini-2025-04-16",
        messages: [
          { role: "system", content: "Eres un asistente especializado en extraer información estructurada sobre personas." },
          { role: "user", content: extractPrompt }
        ],
        // Uso del valor predeterminado de temperature para compatibilidad con o4-mini
        response_format: { type: "json_object" }
      });

      try {
        const content = extractCompletion.choices[0].message.content || '{}';
        
        // Log temporal para debug - remover en producción
        console.log('🔍 [API Stylize] Respuesta de la IA:');
        console.log(content);
        
        const extractResponse = JSON.parse(content);
        
        // Comprobar si la respuesta es un array o un objeto con propiedad 'people'
        if (Array.isArray(extractResponse)) {
          peopleExtracted = extractResponse;
        } else {
          peopleExtracted = extractResponse.people || [];
        }
        
        // 3. Guardar información de personas en la base de datos
        if (peopleExtracted.length > 0 && userId) {
          // Convertir userId a string
          const userIdString = userId.toString();
          
          // Convertir el userIdString a un UUID válido si no lo es ya
          const validUUID = isValidUUID(userIdString) ? userIdString : generateUUID(userIdString);
          
          try {
            await Promise.all(peopleExtracted.map(async (personData) => {
              if (!personData.name) return; // Ignorar entradas sin nombre
              
              // Usar la nueva función que maneja fechas automáticamente
              await saveExtractedPersonInfo(
                personData.name,
                personData.information || {},
                validUUID,
                validEntryDate // Usar la fecha validada
              );
            }));
          } catch (saveError) {
            console.error('Error al guardar personas:', saveError);
            // Continuamos con el proceso aunque falle el guardado
          }
        }
      } catch (parseError) {
        console.error('Error al analizar respuesta JSON:', parseError);
        // Continuamos con el proceso aunque falle la extracción
      }
    }

    return NextResponse.json({ 
      stylizedText,
      peopleExtracted
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
