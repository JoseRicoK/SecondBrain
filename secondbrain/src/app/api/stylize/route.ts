import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getPersonByName, savePerson, isValidUUID, getPeopleByUserId, Person } from '@/lib/supabase';
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
}

interface PersonExtracted {
  name: string;
  information: Record<string, any>;
}

export async function POST(request: Request) {
  try {
    // Extraemos y validamos los datos de la solicitud
    const body = await request.json();
    const { text, userId, extractPeople = true } = body as StylizeRequest;

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
      Eres un asistente especializado en mejorar y estilizar entradas de diario. 
      Tu tarea es tomar el texto transcrito de una grabación de voz y convertirlo en una entrada de diario bien escrita y estructurada.
      
      Instrucciones específicas:
      1. Mantén el contenido y las ideas originales, pero mejora la redacción y estructura.
      2. Corrige errores gramaticales y de puntuación.
      3. Organiza el texto en párrafos coherentes si es necesario.
      4. Elimina muletillas, repeticiones y palabras de relleno típicas del habla.
      5. Mantén un tono personal y auténtico, como si fuera un diario real.
      6. No añadas información que no esté en el texto original.
      7. Respeta el estilo y personalidad del autor.
      
      Texto a estilizar:
      ${text}
      
      Responde SOLO con el texto estilizado, sin comentarios adicionales.
    `;

    const stylizeCompletion = await openai.chat.completions.create({
      model: "gpt-4o",  // Puedes cambiar esto a gpt-3.5-turbo si prefieres
      messages: [
        { role: "system", content: "Eres un asistente especializado en mejorar y estilizar entradas de diario." },
        { role: "user", content: stylizePrompt }
      ],
      temperature: 0.7,
    });

    const stylizedText = stylizeCompletion.choices[0].message.content;
    
    // 2. Extraer información sobre personas mencionadas (si se solicita)
    let peopleExtracted: PersonExtracted[] = [];
    
    if (extractPeople) {
      // Convertir userId a UUID válido para la consulta
      const validUUID = isValidUUID(userId) ? userId : generateUUID(userId);
      
      // 2.1 Obtener personas existentes de la base de datos para proporcionar contexto
      console.log('Obteniendo personas existentes para proporcionar contexto...');
      const existingPeople = await getPeopleByUserId(validUUID);
      
      // Crear una lista formateada de personas existentes para el prompt
      let existingPeopleContext = '';
      if (existingPeople && existingPeople.length > 0) {
        existingPeopleContext = `
Contexto de personas que ya conozco:
`;
        
        existingPeople.forEach((person: Person) => {
          const details = person.details || {};
          const rol = details.rol || 'desconocido';
          const relacion = details.relacion || 'desconocido';
          
          existingPeopleContext += `- ${person.name}: ${relacion}, ${rol}\n`;
        });
        
        console.log('Personas existentes identificadas para contexto:', existingPeople.length);
      } else {
        console.log('No hay personas existentes para proporcionar contexto.');
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

        3. PRESERVAR INFORMACIÓN EXISTENTE:
           - Si en el contexto proporcionado ya existe un rol o relación para una persona, MANTÉN esa información a menos que el texto actual mencione CLARAMENTE un cambio
           - Considera como equivalentes términos similares ("novia"="pareja", "esposa"="mujer", "amigo"="colega", etc.)
           - No cambies "novia" por "pareja" o viceversa si significan lo mismo

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
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Eres un asistente especializado en extraer información estructurada sobre personas." },
          { role: "user", content: extractPrompt }
        ],
        temperature: 0.3,
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
        
        console.log('Personas extraídas:', peopleExtracted);
        
        // 3. Guardar información de personas en la base de datos
        if (peopleExtracted.length > 0 && userId) {
          // Convertir userId a string
          const userIdString = userId.toString();
          
          // Convertir el userIdString a un UUID válido si no lo es ya
          const validUUID = isValidUUID(userIdString) ? userIdString : generateUUID(userIdString);
          
          console.log('Guardando información de personas con userId original:', userIdString);
          console.log('UUID válido generado:', validUUID);
          
          try {
            await Promise.all(peopleExtracted.map(async (personData) => {
              if (!personData.name) return; // Ignorar entradas sin nombre
              
              // Comprobar si la persona ya existe
              const existingPerson = await getPersonByName(personData.name, validUUID);
              
              if (existingPerson) {
                // Actualizar información existente preservando datos previos
                const updatedDetails = { ...existingPerson.details };
                
                // Manejar cada tipo de dato de manera diferente
                if (personData.information) {
                  // Para campos normales como 'rol' y 'relacion', preservar el valor existente
                  // si no hay nueva información
                  Object.entries(personData.information).forEach(([key, value]) => {
                    // Para el campo 'detalles' especialmente, acumular en vez de sobrescribir
                    if (key === 'detalles' && Array.isArray(value)) {
                      // Si ya existen detalles, combinarlos sin duplicados
                      if (updatedDetails.detalles && Array.isArray(updatedDetails.detalles)) {
                        // Filtrar detalles para evitar duplicados
                        const existingDetails = new Set(updatedDetails.detalles);
                        const newDetails = (value as string[]).filter(detail => 
                          !existingDetails.has(detail) && detail.trim() !== ''
                        );
                        
                        // Añadir solo detalles nuevos
                        updatedDetails.detalles = [...updatedDetails.detalles, ...newDetails];
                      } else {
                        // Si no hay detalles previos, usar los nuevos
                        updatedDetails.detalles = value;
                      }
                    } 
                    // Para 'rol' y 'relacion', mantener información valiosa usando reglas semánticas
                    else if (key === 'rol' || key === 'relacion') {
                      const existingValue = (updatedDetails[key] as string || '').toLowerCase();
                      const newValue = (value as string || '').toLowerCase();
                      
                      console.log(`Campo '${key}' - Valor existente: "${existingValue}" | Valor nuevo: "${newValue}"`);
                      
                      // Verificar que los roles no sean relaciones y viceversa
                      if (key === 'rol') {
                        // Lista de términos que son relaciones, no roles
                        const relacionesComunes = ['madre', 'padre', 'hermano', 'hermana', 'hijo', 'hija', 'tio', 'tío', 'tia', 'tía', 
                                                 'amigo', 'amiga', 'novio', 'novia', 'pareja', 'esposo', 'esposa', 'marido', 'mujer',
                                                 'compañero', 'compañera', 'conocido', 'conocida', 'familiar'];
                                                 
                        if (relacionesComunes.some(term => newValue.includes(term))) {
                          console.log(`ADVERTENCIA: El valor "${newValue}" parece ser una relación, no un rol. Se ignorará.`);
                          // Ignoramos este valor ya que es una relación, no un rol
                          // El rol existente se mantiene o queda como 'desconocido'
                          if (!existingValue || existingValue === 'desconocido') {
                            updatedDetails[key] = 'desconocido';
                            console.log(`Se establece rol='desconocido' por ser inválido`);
                          }
                          // No procesamos más este campo
                          return; // Salimos de esta función anónima
                        }
                      }
                      
                      // Función para verificar si dos términos son semánticamente equivalentes
                      const sonEquivalentes = (a: string, b: string): boolean => {
                        // Pares de términos que consideramos equivalentes
                        const equivalentes: [string, string][] = [
                          ['novia', 'pareja'], ['novio', 'pareja'],
                          ['esposa', 'mujer'], ['esposo', 'marido'],
                          ['amigo', 'colega'], ['amiga', 'colega'],
                          ['compañero', 'colega'], ['compañera', 'colega']
                        ];
                        
                        // Verificar si los términos aparecen en alguno de los pares de equivalencia
                        return equivalentes.some(([term1, term2]) => 
                          (a.includes(term1) && b.includes(term2)) || (a.includes(term2) && b.includes(term1))
                        );
                      };
                      
                      // Casos especiales: preservar siempre estos valores si ya existen
                      if (existingValue && existingValue !== 'desconocido' && existingValue.trim() !== '') {
                        // Solo actualizar si hay un cambio significativo y no son términos equivalentes
                        if (newValue && newValue !== 'desconocido' && 
                            newValue.trim() !== '' && 
                            newValue !== existingValue && 
                            !sonEquivalentes(existingValue, newValue)) {
                          
                          console.log(`Actualizando '${key}' de "${existingValue}" a "${newValue}" (cambio significativo)`);
                          updatedDetails[key] = newValue;
                        } else {
                          console.log(`Manteniendo valor existente para '${key}': "${existingValue}"`);
                          // El valor existente se mantiene, no hacemos nada
                        }
                      }
                      // Si no hay valor existente o es genérico, usar el nuevo si tiene contenido
                      else if (newValue && newValue !== 'desconocido' && newValue.trim() !== '') {
                        console.log(`Estableciendo '${key}' a "${newValue}" (no había valor previo válido)`);
                        updatedDetails[key] = newValue;
                      }
                      // Si no hay valor existente ni nuevo valor válido, usar 'desconocido'
                      else if (!existingValue) {
                        console.log(`Estableciendo valor predeterminado para '${key}': "desconocido"`);
                        updatedDetails[key] = 'desconocido';
                      }
                    }
                    // Para otros campos, actualizar normalmente
                    else if (value) {
                      updatedDetails[key] = value;
                    }
                  });
                }
                
                console.log('Actualizando persona con nueva información:', updatedDetails);
                
                await savePerson({
                  id: existingPerson.id,
                  details: updatedDetails
                });
              } else {
                // Crear nueva persona
                await savePerson({
                  user_id: validUUID, // Usamos el UUID válido generado
                  name: personData.name,
                  details: personData.information || {}
                });
              }
            }));
          } catch (saveError) {
            console.error('Error al guardar personas en la base de datos:', saveError);
            // Continuamos con el proceso aunque falle el guardado
          }
        }
      } catch (parseError) {
        console.error('Error al analizar la respuesta JSON de extracción:', parseError);
        // Continuamos con el proceso aunque falle la extracción
      }
    }

    return NextResponse.json({ 
      stylizedText,
      peopleExtracted
    });
  } catch (error: any) {
    console.error('Error en la API de estilización:', error);
    return NextResponse.json(
      { error: `Error al procesar la solicitud: ${error.message}` },
      { status: 500 }
    );
  }
}
