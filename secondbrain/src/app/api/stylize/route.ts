import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { isValidUUID, getPeopleByUserId, Person, PersonDetailCategory, saveExtractedPersonInfo } from '@/lib/supabase';
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
    // Extraemos y validamos los datos de la solicitud
    const body = await request.json();
    const { text, userId, extractPeople = true, entryDate } = body as StylizeRequest;

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
      
      // Crear una lista formateada de personas existentes para el prompt
      let existingPeopleContext = '';
      if (existingPeople && existingPeople.length > 0) {
        existingPeopleContext = `
Contexto de personas que ya conozco:
`;
        
        existingPeople.forEach((person: Person) => {
          const details = person.details || {};
          let relationInfo = 'desconocido';
          let rolInfo = 'desconocido';
          
          // Extraer información del nuevo formato de detalles
          if (details.relacion && typeof details.relacion === 'object' && 'entries' in details.relacion) {
            const entries = (details.relacion as PersonDetailCategory).entries;
            if (entries && entries.length > 0) {
              relationInfo = entries[entries.length - 1].value; // Usar el más reciente
            }
          } else if (typeof details.relacion === 'string') {
            relationInfo = details.relacion;
          }
          
          if (details.rol && typeof details.rol === 'object' && 'entries' in details.rol) {
            const entries = (details.rol as PersonDetailCategory).entries;
            if (entries && entries.length > 0) {
              rolInfo = entries[entries.length - 1].value; // Usar el más reciente
            }
          } else if (typeof details.rol === 'string') {
            rolInfo = details.rol;
          }
          
          existingPeopleContext += `- ${person.name}: relación="${relationInfo}", rol="${rolInfo}"\n`;
        });
      }
      
      const extractPrompt = `
        Analiza el siguiente texto y extrae información sobre las personas mencionadas en él.
        ${existingPeopleContext}
        
        Instrucciones IMPORTANTES para la extracción de personas:

        1. DEFINICIÓN DE CAMPOS:
           - 'rol': SOLO la ocupación o profesión de la persona (estudiante, médico, ingeniero, florista, profesor, etc.)
           - 'relacion': SOLO el vínculo con el narrador (amigo, madre, pareja, hermano, jefe, etc.)
           - 'detalles': Eventos, actividades o hechos relevantes sobre la persona

        2. DISTINGUIR ROL DE RELACIÓN:
           - INCORRECTO: rol="madre del narrador" - Esto NO es un rol sino una relación
           - CORRECTO: rol="florista", relacion="madre" - El rol es la ocupación, la relación es el vínculo

        3. VALORES ÚNICOS Y PRESERVACIÓN:
           - Los campos 'rol' y 'relacion' deben tener UN SOLO VALOR por persona
           - Si en el contexto ya existe información válida (no "desconocido"), MANTÉN esa información exacta a menos que el texto mencione CLARAMENTE un cambio
           - NO uses "desconocido" si ya hay información válida en el contexto
           - NO cambies relaciones específicas por genéricas ("novia" NO debe cambiar a "pareja" si ya está establecido como "novia")
           - Solo usa "desconocido" cuando realmente no puedas determinar la información

        4. IDENTIFICACIÓN DE PERSONAS:
           - Incluye tanto personas mencionadas por nombre como referencias relacionales ("mi madre", "mi hermana")
           - Si una referencia relacional ("mi madre") coincide con alguien del contexto, usa ese nombre

        5. CUANDO NO HAY INFORMACIÓN CLARA:
           - Si no puedes determinar el rol profesional, usa "desconocido" (NO uses la relación como rol)
           - Si no puedes determinar la relación, usa "desconocido" (NO uses el rol como relación)
        
        Texto a analizar:
        ${text}
        
        Tu respuesta DEBE ser un objeto JSON con la siguiente estructura exacta:
        {
          "people": [
            {
              "name": "Nombre completo",
              "information": {
                "rol": "OBLIGATORIO - Ocupación o actividad principal (estudiante, médico, ingeniero)",
                "relacion": "OBLIGATORIO - Tu relación con esta persona (amigo, pareja, familiar)",
                "detalles": [
                  "Incluye aquí datos adicionales como eventos, actividades, etc.",
                  "Cada elemento en una línea separada"
                ]
              }
            }
          ]
        }
        
        RECUERDA: Los campos 'rol' y 'relacion' son OBLIGATORIOS para cada persona. Si no puedes determinarlos con seguridad, utiliza "desconocido".
        
        Si no hay personas mencionadas, devuelve: {"people": []}
        Responde SOLO con el JSON, sin explicaciones adicionales.
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
