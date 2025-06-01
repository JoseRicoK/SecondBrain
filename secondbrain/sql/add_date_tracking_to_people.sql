-- Migración para añadir seguimiento de fechas en los detalles de personas
-- Esta migración actualiza la estructura de datos existente para incluir fechas

-- Primero, vamos a crear una función para migrar los datos existentes
-- y añadir fechas a los detalles que no las tengan
CREATE OR REPLACE FUNCTION migrate_people_details_with_dates()
RETURNS void AS $$
DECLARE
    person_record RECORD;
    updated_details JSONB := '{}';
    detail_key TEXT;
    detail_value JSONB;
    current_timestamp_str TEXT := to_char(now(), 'YYYY-MM-DD');
BEGIN
    -- Recorrer todas las personas que tienen detalles
    FOR person_record IN 
        SELECT id, details, updated_at 
        FROM people 
        WHERE details IS NOT NULL AND details != '{}'::jsonb
    LOOP
        updated_details := '{}';
        
        -- Procesar cada clave en details
        FOR detail_key, detail_value IN 
            SELECT * FROM jsonb_each(person_record.details)
        LOOP
            -- Si el detalle es un array simple (como "detalles"), convertirlo a formato con fechas
            IF jsonb_typeof(detail_value) = 'array' THEN
                -- Convertir array a objeto con entradas fechadas
                updated_details := updated_details || jsonb_build_object(
                    detail_key,
                    jsonb_build_object(
                        'entries', (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'value', item,
                                    'date', to_char(person_record.updated_at, 'YYYY-MM-DD')
                                )
                            )
                            FROM jsonb_array_elements_text(detail_value) AS item
                        )
                    )
                );
            -- Si es un string simple, convertirlo a formato con fecha
            ELSIF jsonb_typeof(detail_value) = 'string' THEN
                updated_details := updated_details || jsonb_build_object(
                    detail_key,
                    jsonb_build_object(
                        'entries', jsonb_build_array(
                            jsonb_build_object(
                                'value', detail_value,
                                'date', to_char(person_record.updated_at, 'YYYY-MM-DD')
                            )
                        )
                    )
                );
            -- Si ya tiene estructura de objeto, mantenerlo (podría ser una migración parcial)
            ELSE
                updated_details := updated_details || jsonb_build_object(detail_key, detail_value);
            END IF;
        END LOOP;
        
        -- Actualizar la persona con los nuevos detalles
        UPDATE people 
        SET details = updated_details 
        WHERE id = person_record.id;
        
        RAISE NOTICE 'Migrada persona ID: %, detalles actualizados', person_record.id;
    END LOOP;
    
    RAISE NOTICE 'Migración completada exitosamente';
END;
$$ LANGUAGE plpgsql;

-- Comentario explicativo sobre la nueva estructura
COMMENT ON FUNCTION migrate_people_details_with_dates() IS 
'Función para migrar datos existentes de personas a la nueva estructura con fechas. 
La nueva estructura convierte arrays simples y strings a objetos con entradas fechadas:
{
  "rol": {
    "entries": [
      {"value": "estudiante", "date": "2024-01-15"}
    ]
  },
  "detalles": {
    "entries": [
      {"value": "Estudia ingeniería", "date": "2024-01-15"},
      {"value": "Le gusta la música", "date": "2024-01-20"}
    ]
  }
}';

-- Ejecutar la migración (descomenta la siguiente línea para ejecutar)
-- SELECT migrate_people_details_with_dates();

-- Crear un índice para mejorar las consultas por fechas en los detalles
CREATE INDEX IF NOT EXISTS people_details_gin_idx ON people USING GIN (details);

-- Comentario sobre el nuevo formato esperado
COMMENT ON COLUMN people.details IS 
'Información estructurada sobre la persona en formato JSON. 
Nueva estructura recomendada:
{
  "category_name": {
    "entries": [
      {"value": "información", "date": "YYYY-MM-DD"},
      {"value": "más información", "date": "YYYY-MM-DD"}
    ]
  }
}
Esto permite rastrear cuándo se añadió cada detalle específico.';
