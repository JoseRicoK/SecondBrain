import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getPeopleByUserId, Person, PersonDetailCategory, saveExtractedPersonInfo, incrementPersonMentionCount, updateEntryMoodData } from '@/lib/firebase-operations';

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Interfaz para la solicitud de extracción de personas
interface ExtractPeopleRequest {
  text: string;
  userId: string;
  entryDate?: string; // Fecha de la entrada del diario para añadir a los detalles
  entryId?: string; // ID de la entrada para actualizar el estado de ánimo
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
    const { text, userId, entryDate, entryId } = body as ExtractPeopleRequest;

    if (user.uid !== userId) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    if (!text || text.trim() === '') {
      return NextResponse.json(
        { error: 'No se proporcionó texto para analizar' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Se requiere el ID del usuario' },
        { status: 400 }
      );
    }

    if (!entryDate) {
      return NextResponse.json(
        { error: 'Se requiere la fecha de la entrada' },
        { status: 400 }
      );
    }

    // Usar la fecha proporcionada (siempre debe venir del frontend)
    const validEntryDate = entryDate;
    
    console.log('🔍 [API Extract People] Fecha recibida desde frontend:', entryDate);
    console.log('🔍 [API Extract People] Fecha validada para usar:', validEntryDate);

    // Convertir userId a UUID válido para la consulta (usar directamente el userId de Firebase)
    const validUUID = userId; // Usar directamente el userId de Firebase Auth
    
    // Obtener personas existentes de la base de datos para proporcionar contexto
    const existingPeople = await getPeopleByUserId(validUUID);
    
    // Construir contexto detallado de personas conocidas para el día actual
    let peopleContext = '';
    if (existingPeople && existingPeople.length > 0) {
      console.log('🔍 [API Extract People] Construyendo contexto de personas para fecha:', validEntryDate);
      
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
          personInfo += `, INFORMACIÓN YA REGISTRADA HOY (${validEntryDate})=[${todayDetails.join(', ')}]`;
        } else {
          personInfo += `, SIN INFORMACIÓN REGISTRADA HOY (${validEntryDate})`;
        }
        
        peopleContext += personInfo + '\n';
      });
    } else {
      peopleContext = 'No tengo información previa sobre ninguna persona.';
    }
    
    // Log temporal para debug - remover en producción
    console.log('🔍 [API Extract People] Contexto completo de personas:', peopleContext);
    console.log('🔍 [API Extract People] Fecha de entrada recibida:', validEntryDate);
    console.log('🔍 [API Extract People] Texto a analizar:', text);
    console.log('🔍 [API Extract People] Enviando prompt a OpenAI...');
    
    // Formatear la fecha de la entrada para el contexto - asegurar que use la fecha exacta
    const [year, month, day] = validEntryDate.split('-').map(Number);
    const entryDateObj = new Date(year, month - 1, day); // month - 1 porque Date usa meses 0-indexados
    const entryDateFormatted = entryDateObj.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    console.log('🔍 [API Extract People] Fecha formateada para IA:', entryDateFormatted);
    
    const extractPrompt = `
      Analiza el siguiente texto y extrae información sobre las personas mencionadas en él.
      
      FECHA DE LA ENTRADA DEL DIARIO: ${entryDateFormatted} (${validEntryDate})
      IMPORTANTE: Cuando el texto mencione "hoy", "ayer", "mañana", etc., usa esta fecha como referencia.
      
      ${peopleContext}
      
      Instrucciones para la extracción de personas:

      1. INCLUYE personas mencionadas de cualquier forma:
         - Nombres explícitos: "María", "Juan", "Dr. García"
         - Referencias familiares: "mi madre", "mi novia", "mi hermano"
         - Referencias relacionales: "mi amigo", "mi jefe", "mi compañero"
      2. SOLO incluye información que se menciona EXPLÍCITAMENTE en el texto actual
      3. NO incluyas información que no esté mencionada en el texto

      4. EVITAR DUPLICADOS CRÍTICO - ESPECIALMENTE DEL MISMO DÍA:
         - La "INFORMACIÓN YA REGISTRADA HOY" es información YA GUARDADA para la fecha ${entryDateFormatted}
         - Si el texto menciona algo que YA ESTÁ en "INFORMACIÓN YA REGISTRADA HOY", NO lo incluyas
         - Si una persona muestra "SIN INFORMACIÓN REGISTRADA HOY", puedes agregar cualquier detalle nuevo
         - Busca información COMPLETAMENTE NUEVA que no esté ya registrada para esta fecha
         - Ejemplos de duplicados a evitar:
           * Ya registrado hoy: "tiene examen de matemáticas" → Texto: "examen de mates" = NO incluir
           * Ya registrado hoy: "fue al gimnasio" → Texto: "estuvo en el gym" = NO incluir
           * Ya registrado hoy: "comió pizza" → Texto: "cenó pizza" = SÍ incluir (son eventos diferentes)
         - REGLA DE ORO: Si hay duda sobre si es duplicado del mismo día, NO lo incluyas

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

      8. MANEJO DE REFERENCIAS RELACIONALES:
         - Si el texto dice "mi novia" y ya conoces el nombre de esa persona (ej: relación='novia'), usa el nombre conocido
         - Si el texto dice "mi novia" y NO conoces quién es la novia, créala como nueva persona con name="mi novia" y relacion="novia"
         - Si el texto dice "mi madre" y NO conoces quién es la madre, créala como nueva persona con name="mi madre" y relacion="madre"
         - Mismo principio para: "mi hermano", "mi amigo", "mi jefe", etc.

      EJEMPLOS DE COMPORTAMIENTO CORRECTO:
      
      Contexto: "Vero: rol='estudiante', relación='novia', cumpleaños='15 de marzo', INFORMACIÓN YA REGISTRADA HOY (2025-06-15)=[tiene examen de matemáticas]"
      Texto: "Vero tiene examen mañana"
      Respuesta: {"people": []} (porque "examen" ya está registrado hoy)
      
      Contexto: "Vero: rol='estudiante', relación='novia', INFORMACIÓN YA REGISTRADA HOY (2025-06-20)=[tiene examen de matemáticas]"
      Fecha de entrada: "jueves, 20 de junio de 2025"
      Texto: "Hoy es el cumpleaños de Vero y fue al gimnasio"
      Respuesta: {"people": [{"name": "Vero", "information": {"cumpleaños": "20 de junio", "detalles": ["fue al gimnasio"]}}]}
      
      Contexto: "Ana: rol='médica', INFORMACIÓN YA REGISTRADA HOY (2025-06-15)=[trabajó en el hospital, cenó pasta]"
      Texto: "Ana estuvo trabajando en el hospital y comió pasta para cenar"
      Respuesta: {"people": []} (porque "trabajó en el hospital" y "cenó pasta" ya están registrados hoy)
      
      Contexto: "Pedro: INFORMACIÓN YA REGISTRADA HOY (2025-06-15)=[fue al gimnasio]"
      Texto: "Pedro fue al gym por la mañana y luego estudió para el examen"
      Respuesta: {"people": [{"name": "Pedro", "information": {"detalles": ["estudió para el examen"]}}]} (gimnasio ya registrado, pero estudio es nuevo)
      
      Contexto: "Luis: SIN INFORMACIÓN REGISTRADA HOY (2025-06-15)"
      Texto: "Luis fue a comprar y luego volvió a casa"
      Respuesta: {"people": [{"name": "Luis", "information": {"detalles": ["fue a comprar", "volvió a casa"]}}]}
      
      Contexto: "No tengo información previa"
      Texto: "Mi novia me ha preparado una tarta"
      Respuesta: {"people": [{"name": "mi novia", "information": {"relacion": "novia", "detalles": ["me ha preparado una tarta"]}}]}
      
      Contexto: "Vero: rol='estudiante', relación='novia'"
      Texto: "Mi novia me ha preparado una tarta"
      Respuesta: {"people": [{"name": "Vero", "information": {"detalles": ["me ha preparado una tarta"]}}]} (usa el nombre conocido)
      
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
      console.log('✅ [API Extract People] El prompt contiene "cumpleaños" con ñ correctamente');
    } else {
      console.log('❌ [API Extract People] ERROR: El prompt NO contiene "cumpleaños" con ñ');
    }

    const extractCompletion = await openai.chat.completions.create({
      model: "o4-mini-2025-04-16",
      messages: [
        { role: "system", content: "Eres un asistente especializado en extraer información estructurada sobre personas." },
        { role: "user", content: extractPrompt }
      ],
      response_format: { type: "json_object" }
    });

    let peopleExtracted: PersonExtracted[] = [];

    try {
      const content = extractCompletion.choices[0].message.content || '{}';
      
      // Log temporal para debug - remover en producción
      console.log('🔍 [API Extract People] Respuesta de la IA:');
      console.log(content);
      
      const extractResponse = JSON.parse(content);
      
      // Verificar específicamente si hay "cumpleaños" con ñ en la respuesta de la IA
      const contentLower = content.toLowerCase();
      if (contentLower.includes('cumpleaños') || contentLower.includes('cumpleanos')) {
        console.log('🎂 [API Extract People] Verificando cumpleaños en respuesta IA:');
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
            console.log(`🎂 [API Extract People] Persona ${index + 1} - ${person.name}:`);
            console.log('- Tiene "cumpleaños" (con ñ):', !!info.cumpleaños);
            console.log('- Tiene "cumpleanos" (sin ñ):', !!info.cumpleanos);
            console.log('- Información completa:', JSON.stringify(info));
          }
        });
      }
      
      // Guardar información de personas en la base de datos
      if (peopleExtracted.length > 0 && userId) {
        // Convertir userId a string (usar directamente el userId de Firebase)
        const userIdString = userId.toString();
        
        // Usar directamente el userIdString sin convertir a UUID
        const validUUID = userIdString;
        
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
            
            // Incrementar el contador de menciones para esta persona
            await incrementPersonMentionCount(validUUID, personData.name);
          }));
        } catch (saveError) {
          console.error('Error al guardar personas:', saveError);
          return NextResponse.json(
            { error: 'Error al guardar la información de personas' },
            { status: 500 }
          );
        }
      }
    } catch (parseError) {
      console.error('Error al analizar respuesta JSON:', parseError);
      return NextResponse.json(
        { error: 'Error al procesar la respuesta de la IA' },
        { status: 500 }
      );
    }

    // Análisis de estado de ánimo si se proporciona entryId
    let moodAnalysis = null;
    if (entryId && text.trim().length > 0) {
      try {
        const moodAnalysisPrompt = `
          Analiza el siguiente texto de entrada de diario y evalúa cada estado emocional del 0 al 100.
          Cada categoría debe ser evaluada independientemente según su intensidad real en el texto.
          
          GUÍAS DE EVALUACIÓN:
          
          ESTRÉS (0-100): Ansiedad, presión, preocupaciones, tensión, agobio, conflictos, discusiones, problemas
          - 0-20: Muy poco o ningún estrés
          - 21-40: Estrés leve, pequeñas preocupaciones
          - 41-60: Estrés moderado, situaciones complicadas
          - 61-80: Estrés alto, conflictos importantes, discusiones serias
          - 81-100: Estrés extremo, crisis, situaciones muy tensas
          
          TRANQUILIDAD (0-100): Calma, serenidad, paz, relajación, equilibrio
          - 0-20: Muy agitado, sin paz mental
          - 21-40: Poca tranquilidad, inquietud
          - 41-60: Tranquilidad moderada
          - 61-80: Bastante tranquilo, en calma
          - 81-100: Muy tranquilo, en completa paz
          
          FELICIDAD (0-100): Alegría, satisfacción, logros, momentos positivos, entusiasmo
          - 0-20: Muy poca o ninguna felicidad
          - 21-40: Felicidad leve, algunos momentos agradables
          - 41-60: Felicidad moderada
          - 61-80: Bastante feliz, buenos momentos
          - 81-100: Muy feliz, euforia, gran alegría
          
          TRISTEZA (0-100): Melancolía, pena, nostalgia, desánimo, dolor emocional, decepción
          - 0-20: Muy poca o ninguna tristeza
          - 21-40: Tristeza leve, ligero desánimo
          - 41-60: Tristeza moderada, momentos melancólicos
          - 61-80: Tristeza considerable, dolor emocional
          - 81-100: Tristeza profunda, gran dolor emocional
          
          EJEMPLOS DE SITUACIONES:
          - Discusión/pelea con pareja/amigo: Estrés 70-85, Tranquilidad 10-25, Felicidad 10-30, Tristeza 60-80
          - Día productivo en el trabajo: Estrés 20-40, Tranquilidad 60-80, Felicidad 70-85, Tristeza 5-20
          - Muerte de familiar: Estrés 60-80, Tranquilidad 10-30, Felicidad 5-20, Tristeza 80-95
          - Reunión con amigos: Estrés 5-25, Tranquilidad 60-80, Felicidad 70-90, Tristeza 5-20
          
          Evalúa cada emoción considerando el contexto, las palabras utilizadas y la intensidad emocional del texto.
          
          Texto a analizar:
          ${text.slice(0, 2000)}
          
          Responde SOLO con un objeto JSON en este formato exacto:
          {"stress": 25, "tranquility": 70, "happiness": 80, "sadness": 10}
          
          Cada valor debe estar entre 0 y 100 y reflejar la intensidad real de cada emoción.
        `;

        const moodCompletion = await openai.chat.completions.create({
          model: "o4-mini-2025-04-16",
          messages: [
            { 
              role: "system", 
              content: "Eres un psicólogo experto en análisis de estados emocionales en textos. Tu objetivo es detectar con precisión y sensibilidad las emociones humanas, especialmente en situaciones de conflicto, estrés, tristeza o alegría. Sé perceptivo a las sutilezas emocionales y evalúa cada emoción de forma independiente según su intensidad real en el contexto." 
            },
            { role: "user", content: moodAnalysisPrompt }
          ],
          response_format: { type: "json_object" }
        });

        const moodResult = JSON.parse(moodCompletion.choices[0].message.content || '{"stress": 30, "tranquility": 40, "happiness": 40, "sadness": 20}');
        
        // Validar que los valores estén entre 0 y 100
        const validateMoodValue = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
        
        const validatedMood = {
          stress: validateMoodValue(moodResult.stress || 0),
          tranquility: validateMoodValue(moodResult.tranquility || 0),
          happiness: validateMoodValue(moodResult.happiness || 0),
          sadness: validateMoodValue(moodResult.sadness || 0)
        };

        // Guardar el análisis de estado de ánimo en la entrada
        const moodUpdated = await updateEntryMoodData(entryId, validatedMood);

        if (moodUpdated) {
          moodAnalysis = validatedMood;
          console.log('✅ [API Extract People] Estado de ánimo analizado y guardado:', validatedMood);
        }
      } catch (moodError) {
        console.error('❌ [API Extract People] Error al analizar estado de ánimo:', moodError);
      }
    }

    return NextResponse.json({ 
      peopleExtracted,
      moodAnalysis,
      message: peopleExtracted.length > 0 
        ? `Se han extraído y guardado ${peopleExtracted.length} persona(s) con información nueva` 
        : 'No se encontró información nueva para extraer. Las personas ya mencionadas se mantienen sin cambios.',
      totalPeopleProcessed: peopleExtracted.length,
      date: validEntryDate
    });
  } catch (error) {
    console.error('Error en API de extracción de personas:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error al procesar la solicitud: ${errorMessage}` },
      { status: 500 }
    );
  }
}
