-- Añadir la columna mentioned_people a la tabla diary_entries
ALTER TABLE diary_entries
ADD COLUMN mentioned_people TEXT[] DEFAULT '{}'::TEXT[];

-- Comentario para documentar el propósito de la columna
COMMENT ON COLUMN diary_entries.mentioned_people IS 'Array de nombres de personas mencionadas en la entrada';
