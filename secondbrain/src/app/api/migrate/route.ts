import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Iniciando migración de datos de personas...');

    // Verificar que tengamos conexión a Supabase
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase no está configurado' },
        { status: 500 }
      );
    }

    // Ejecutar migración manual directamente (más confiable)
    const result = await manualMigration();
    return result;

  } catch (error) {
    console.error('❌ Error en migración:', error);
    return NextResponse.json(
      { 
        error: 'Error en la migración', 
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

// Función de migración manual como fallback
async function manualMigration() {
  try {
    console.log('🔄 Ejecutando migración manual...');

    // Obtener todas las personas
    const { data: people, error: fetchError } = await supabase
      .from('people')
      .select('*');

    if (fetchError) {
      throw new Error(`Error obteniendo personas: ${fetchError.message}`);
    }

    if (!people || people.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay personas para migrar',
        migratedCount: 0
      });
    }

    console.log(`📋 Encontradas ${people.length} personas para migrar`);

    let migratedCount = 0;
    let alreadyMigratedCount = 0;
    const migrationDetails: string[] = [];

    for (const person of people) {
      if (!person.details || Object.keys(person.details).length === 0) {
        continue;
      }

      const updatedDetails: Record<string, any> = {};
      let needsUpdate = false;

      for (const [key, value] of Object.entries(person.details)) {
        // Verificar si ya está en el nuevo formato
        if (value && typeof value === 'object' && 'entries' in value && Array.isArray(value.entries)) {
          // Ya está migrado
          updatedDetails[key] = value;
          continue;
        }

        // Necesita migración
        needsUpdate = true;
        const fallbackDate = person.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0];

        // Si es un array, convertir a nuevo formato
        if (Array.isArray(value)) {
          updatedDetails[key] = {
            entries: value
              .filter(item => item && String(item).trim())
              .map((item: string) => ({
                value: String(item).trim(),
                date: fallbackDate
              }))
          };
          migrationDetails.push(`${person.name}: ${key} (array con ${value.length} elementos)`);
        }
        // Si es un string, convertir a nuevo formato
        else if (typeof value === 'string' && value.trim()) {
          updatedDetails[key] = {
            entries: [{
              value: value.trim(),
              date: fallbackDate
            }]
          };
          migrationDetails.push(`${person.name}: ${key} (string)`);
        }
        // Si es otro tipo, intentar preservarlo o convertirlo
        else if (value) {
          updatedDetails[key] = {
            entries: [{
              value: String(value),
              date: fallbackDate
            }]
          };
          migrationDetails.push(`${person.name}: ${key} (convertido de ${typeof value})`);
        }
        // Si es null/undefined, crear entrada vacía
        else {
          updatedDetails[key] = { entries: [] };
        }
      }

      // Solo actualizar si es necesario
      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('people')
          .update({ 
            details: updatedDetails,
            updated_at: new Date().toISOString()
          })
          .eq('id', person.id);

        if (updateError) {
          console.error(`❌ Error actualizando persona ${person.id}:`, updateError);
          throw new Error(`Error actualizando ${person.name}: ${updateError.message}`);
        } else {
          migratedCount++;
          console.log(`✅ Migrada persona: ${person.name} (${person.id})`);
        }
      } else {
        alreadyMigratedCount++;
        console.log(`ℹ️ Persona ya migrada: ${person.name} (${person.id})`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migración completada exitosamente. ${migratedCount} personas actualizadas, ${alreadyMigratedCount} ya estaban migradas.`,
      migratedCount,
      alreadyMigratedCount,
      totalPersons: people.length,
      details: migrationDetails
    });

  } catch (error) {
    console.error('❌ Error en migración manual:', error);
    return NextResponse.json(
      { 
        error: 'Error en migración manual', 
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

// Endpoint para verificar datos antes de la migración
export async function GET() {
  try {
    const { data: people, error } = await supabase
      .from('people')
      .select('id, name, details')
      .limit(5);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      sampleData: people,
      message: 'Datos de muestra obtenidos correctamente'
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Error obteniendo datos', 
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
