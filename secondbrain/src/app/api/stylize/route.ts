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
      
      // Construir contexto detallado de personas conocidas para el día actual
      let peopleContext = '';
      if (existingPeople && existingPeople.length > 0) {
        console.log('🔍 [API Stylize] Construyendo contexto de personas para fecha:', validEntryDate);
        
        peopleContext = 'Personas que ya conozco:\n';
        existingPeople.forEach((person: Person) => {
          const details = person.details || {};
          let personInfo = `- ${person.name}:`;
          
          // Obtener rol, relación, cumpleaños y dirección más recientes
          let currentRole = 'desconocido';
          let currentRelation = 'desconocido';
          let currentBirthday = '';
          let currentAddress = '';
          
          if (details.rol && typeof details.rol === 'object' && 'entries' in details.rol) {
            const entries = (details.rol as PersonDetailCategory).entries;
            if (entries && entries.length > 0) {
              currentRole = entries[entries.length - 1].value;
            }
          } else if (typeof details.rol === 'string') {
            currentRole = details.rol;
          }
          
          if (details.relacion && typeof details.relacion === 'object' && 'entries' in details.relacion) {
            const entries = (details.relacion as PersonDetailCategory).entries;
            if (entries && entries.length > 0) {
              currentRelation = entries[entries.length - 1].value;
            }
          } else if (typeof details.relacion === 'string') {
            currentRelation = details.relacion;
          }

          if (details.cumpleaños && typeof details.cumpleaños === 'object' && 'entries' in details.cumpleaños) {
            const entries = (details.cumpleaños as PersonDetailCategory).entries;
            if (entries && entries.length > 0) {
              currentBirthday = entries[entries.length - 1].value;
            }
          } else if (typeof details.cumpleaños === 'string') {
            currentBirthday = details.cumpleaños;
          }

          if (details.direccion && typeof details.direccion === 'object' && 'entries' in details.direccion) {
            const entries = (details.direccion as PersonDetailCategory).entries;
            if (entries && entries.length > 0) {
              currentAddress = entries[entries.length - 1].value;
            }
          } else if (typeof details.direccion === 'string') {
            currentAddress = details.direccion;
          }
          
          personInfo += ` rol="${currentRole}", relación="${currentRelation}"`;
          if (currentBirthday) personInfo += `, cumpleaños="${currentBirthday}"`;
          if (currentAddress) personInfo += `, dirección="${currentAddress}"`;
          
          // Obtener detalles SOLO del día actual
          const todayDetails: string[] = [];
          for (const [key, value] of Object.entries(details)) {
            if (key !== 'rol' && key !== 'relacion' && key !== 'cumpleaños' && key !== 'direccion' && value) {
              if (typeof value === 'object' && 'entries' in value) {
                const entries = (value as PersonDetailCategory).entries;
                if (entries && entries.length > 0) {
                  // Filtrar solo las entradas del día actual
                  const todayEntries = entries.filter(entry => entry.date === validEntryDate);
                  todayEntries.forEach(entry => {
                    todayDetails.push(`${key}: ${entry.value}`);
                  });
                }
              } else if (typeof value === 'string') {
                // Para formato antiguo, no tenemos fecha, lo incluimos con precaución
                todayDetails.push(`${key}: ${value}`);
              }
            }
          }
          
          if (todayDetails.length > 0) {
            personInfo += `, detalles del día de hoy=[${todayDetails.join(', ')}]`;
          }
          
          peopleContext += personInfo + '\n';
        });
      } else {
        peopleContext = 'No tengo información previa sobre ninguna persona.';
      }
      
      // Log temporal para debug - remover en producción
      console.log('🔍 [API Stylize] Contexto completo de personas:', peopleContext);
      console.log('🔍 [API Stylize] Fecha de entrada recibida:', validEntryDate);
      
      // Formatear la fecha de la entrada para el contexto - asegurar que use la fecha exacta
      const [year, month, day] = validEntryDate.split('-').map(Number);
      const entryDate = new Date(year, month - 1, day); // month - 1 porque Date usa meses 0-indexados
      const entryDateFormatted = entryDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      console.log('🔍 [API Stylize] Fecha formateada para IA:', entryDateFormatted);
      
      const extractPrompt = `
        Analiza el siguiente texto y extrae información sobre las personas mencionadas en él.
        
        FECHA DE LA ENTRADA DEL DIARIO: ${entryDateFormatted} (${validEntryDate})
        IMPORTANTE: Cuando el texto mencione "hoy", "ayer", "mañana", etc., usa esta fecha como referencia.
        
        ${peopleContext}
        
        Instrucciones para la extracción de personas:

        1. SOLO incluye personas que se mencionan EXPLÍCITAMENTE en el texto actual
        2. SOLO incluye información que se menciona EXPLÍCITAMENTE en el texto actual
        3. NO incluyas información que no esté mencionada en el texto

        4. EVITAR DUPLICADOS IMPORTANTES:
           - Revisa cuidadosamente los "detalles del día de hoy" de cada persona conocida
           - Si el texto menciona algo muy similar a lo que ya está registrado HOY, NO lo incluyas
           - Solo incluye información realmente nueva o significativamente diferente
           - Ejemplo: Si ya hay "tiene examen de matemáticas" y el texto dice "examen de mates", NO lo duplicar

        5. DEFINICIÓN DE CAMPOS:
           - 'rol': SOLO si el texto menciona una ocupación o profesión (estudiante, médico, ingeniero, etc.)
           - 'relacion': SOLO si el texto menciona una relación contigo (amigo, madre, pareja, hermano, etc.)
           - 'cumpleanos': SOLO si el texto menciona una fecha de cumpleaños (ej: "cumple el 15 de marzo", "nació en diciembre", etc.)
           - 'direccion': SOLO si el texto menciona una dirección o ubicación donde vive (ej: "vive en Madrid", "su casa está en...", etc.)
           - 'detalles': Eventos, actividades o hechos mencionados sobre la persona

        6. REFERENCIAS TEMPORALES:
           - Cuando el texto dice "hoy", "ayer", "mañana", usa la fecha de la entrada como referencia
           - Si se menciona "hoy es el cumpleaños de X", interpreta como cumpleaños en la fecha de la entrada
           - Para fechas específicas (ej: "15 de marzo"), úsalas tal como aparecen
           - Para referencias relativas, calcula basándote en la fecha de la entrada

        7. Si una persona conocida se menciona pero no se dice nueva información sobre ella, NO la incluyas en la respuesta

        8. Si el texto dice "mi madre" o "mi hermana" pero ya conoces el nombre de esa persona, usa el nombre conocido

        EJEMPLOS DE COMPORTAMIENTO CORRECTO:
        
        Contexto: "Vero: rol='estudiante', relación='novia', cumpleaños='15 de marzo', detalles del día de hoy=[tiene examen de matemáticas]"
        Texto: "Vero tiene examen mañana"
        Respuesta: {"people": []} (porque "examen" ya está registrado hoy)
        
        Contexto: "Vero: rol='estudiante', relación='novia', detalles del día de hoy=[tiene examen de matemáticas]"
        Fecha de entrada: "jueves, 20 de junio de 2025"
        Texto: "Hoy es el cumpleaños de Vero y fue al gimnasio"
        Respuesta: {"people": [{"name": "Vero", "information": {"cumpleanos": "20 de junio", "detalles": ["fue al gimnasio"]}}]}
        
        Contexto: "No tengo información previa"
        Texto: "Conocí a Juan, es médico y vive en Barcelona"
        Respuesta: {"people": [{"name": "Juan", "information": {"rol": "médico", "direccion": "Barcelona"}}]}
        
        Contexto: "María: rol='profesora', relación='amiga'"
        Fecha de entrada: "sábado, 15 de diciembre de 2025"
        Texto: "Hoy cumple años María y se mudó a Valencia"
        Respuesta: {"people": [{"name": "María", "information": {"direccion": "Valencia", "cumpleaños": "15 de diciembre"}}]}
        
        ATENCIÓN: USA SIEMPRE "cumpleaños" con ñ en tus respuestas, NUNCA "cumpleanos" sin ñ.
        
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
                "cumpleaños": "OPCIONAL - Solo si se menciona fecha de cumpleaños - USA SIEMPRE LA Ñ",
                "direccion": "OPCIONAL - Solo si se menciona dirección o ubicación",
                "detalles": [
                  "Solo información nueva mencionada en el texto que NO esté ya registrada hoy"
                ]
              }
            }
          ]
        }
        
        Si no hay personas mencionadas con información nueva, devuelve: {"people": []}
        Responde SOLO con el JSON, sin explicaciones.
      `;

      // Log temporal para verificar que el prompt incluye la ñ
      if (extractPrompt.includes('cumpleaños')) {
        console.log('✅ [API Stylize] El prompt contiene "cumpleaños" con ñ correctamente');
      } else {
        console.log('❌ [API Stylize] ERROR: El prompt NO contiene "cumpleaños" con ñ');
      }

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
        
        // Verificar específicamente si hay "cumpleaños" con ñ en la respuesta de la IA
        const contentLower = content.toLowerCase();
        if (contentLower.includes('cumpleaños') || contentLower.includes('cumpleanos')) {
          console.log('🎂 [API Stylize] Verificando cumpleaños en respuesta IA:');
          console.log('- Contiene "cumpleaños" (con ñ):', contentLower.includes('cumpleaños'));
          console.log('- Contiene "cumpleanos" (sin ñ):', contentLower.includes('cumpleanos'));
          console.log('- Respuesta completa:', content);
        }
        
        // Comprobar si la respuesta es un array o un objeto con propiedad 'people'
        if (Array.isArray(extractResponse)) {
          peopleExtracted = extractResponse;
        } else {
          peopleExtracted = extractResponse.people || [];
        }
        
        // Verificar que "cumpleaños" mantenga la ñ después del JSON.parse
        if (peopleExtracted.length > 0) {
          peopleExtracted.forEach((person, index) => {
            const info = person.information || {};
            if (info.cumpleaños || info.cumpleanos) {
              console.log(`🎂 [API Stylize] Persona ${index + 1} - ${person.name}:`);
              console.log('- Tiene "cumpleaños" (con ñ):', !!info.cumpleaños);
              console.log('- Tiene "cumpleanos" (sin ñ):', !!info.cumpleanos);
              console.log('- Información completa:', JSON.stringify(info));
            }
          });
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
