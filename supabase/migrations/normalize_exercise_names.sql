-- Migración: Normalización de nombres de ejercicios
-- Asegura consistencia entre historial, planes y catálogo

-- Habilitar pg_trgm para fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Función de normalización (misma lógica que el TypeScript)
CREATE OR REPLACE FUNCTION normalizar_nombre_ejercicio(nombre TEXT)
RETURNS TEXT AS $$
DECLARE
  palabras TEXT[];
  resultado TEXT[];
  preposiciones TEXT[] := ARRAY['de', 'del', 'con', 'a', 'la', 'el', 'en', 'y', 'e', 'al'];
  p TEXT;
  i INT;
BEGIN
  IF nombre IS NULL OR TRIM(nombre) = '' THEN
    RETURN 'Ejercicio';
  END IF;

  -- Trim, quitar puntuación final, colapsar espacios, lowercase
  nombre := TRIM(REGEXP_REPLACE(nombre, '[.,;:!?]+$', ''));
  nombre := TRIM(REGEXP_REPLACE(nombre, '\s+', ' ', 'g'));
  nombre := LOWER(nombre);

  palabras := STRING_TO_ARRAY(nombre, ' ');
  resultado := ARRAY[]::TEXT[];

  FOR i IN 1..ARRAY_LENGTH(palabras, 1) LOOP
    p := palabras[i];
    IF i = 1 OR NOT (p = ANY(preposiciones)) THEN
      p := UPPER(LEFT(p, 1)) || SUBSTRING(p, 2);
    END IF;
    resultado := ARRAY_APPEND(resultado, p);
  END LOOP;

  RETURN ARRAY_TO_STRING(resultado, ' ');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Normalizar historial_series.ejercicio
UPDATE historial_series
SET ejercicio = normalizar_nombre_ejercicio(ejercicio)
WHERE ejercicio IS NOT NULL
  AND ejercicio != normalizar_nombre_ejercicio(ejercicio);

-- 2. Matchear con catálogo usando similitud (corregir variantes históricas)
UPDATE historial_series h
SET ejercicio = c.nombre
FROM catalogo_ejercicios c
WHERE h.ejercicio != c.nombre
  AND similarity(LOWER(h.ejercicio), LOWER(c.nombre)) > 0.65;

-- 3. Normalizar nombres en planes_semanales.datos_semana (JSONB)
DO $$
DECLARE
  rec RECORD;
  dia_key TEXT;
  dia_data JSONB;
  ejercicios JSONB;
  nuevo_ejercicio JSONB;
  nuevos_ejercicios JSONB;
  nuevo_datos JSONB;
  i INT;
BEGIN
  FOR rec IN SELECT id, datos_semana FROM planes_semanales WHERE datos_semana IS NOT NULL LOOP
    nuevo_datos := rec.datos_semana;
    FOR dia_key IN SELECT jsonb_object_keys(rec.datos_semana) LOOP
      dia_data := rec.datos_semana -> dia_key;
      ejercicios := dia_data -> 'ejercicios';
      IF ejercicios IS NOT NULL AND jsonb_typeof(ejercicios) = 'array' THEN
        nuevos_ejercicios := '[]'::JSONB;
        FOR i IN 0..jsonb_array_length(ejercicios) - 1 LOOP
          nuevo_ejercicio := ejercicios -> i;
          IF nuevo_ejercicio ? 'nombre' THEN
            nuevo_ejercicio := jsonb_set(
              nuevo_ejercicio,
              '{nombre}',
              to_jsonb(normalizar_nombre_ejercicio(nuevo_ejercicio ->> 'nombre'))
            );
          END IF;
          nuevos_ejercicios := nuevos_ejercicios || jsonb_build_array(nuevo_ejercicio);
        END LOOP;
        dia_data := jsonb_set(dia_data, '{ejercicios}', nuevos_ejercicios);
        nuevo_datos := jsonb_set(nuevo_datos, ARRAY[dia_key], dia_data);
      END IF;
    END LOOP;
    UPDATE planes_semanales SET datos_semana = nuevo_datos WHERE id = rec.id;
  END LOOP;
END $$;

-- 4. Normalizar nombres en rutinas_personalizadas.ejercicios (JSONB array)
DO $$
DECLARE
  rec RECORD;
  arr_ejercicios JSONB;
  nuevo_ejercicio JSONB;
  nuevos_ejercicios JSONB;
  i INT;
BEGIN
  FOR rec IN SELECT id, ejercicios FROM rutinas_personalizadas WHERE ejercicios IS NOT NULL LOOP
    arr_ejercicios := rec.ejercicios;
    IF jsonb_typeof(arr_ejercicios) = 'array' THEN
      nuevos_ejercicios := '[]'::JSONB;
      FOR i IN 0..jsonb_array_length(arr_ejercicios) - 1 LOOP
        nuevo_ejercicio := arr_ejercicios -> i;
        IF nuevo_ejercicio ? 'nombre' THEN
          nuevo_ejercicio := jsonb_set(
            nuevo_ejercicio,
            '{nombre}',
            to_jsonb(normalizar_nombre_ejercicio(nuevo_ejercicio ->> 'nombre'))
          );
        END IF;
        nuevos_ejercicios := nuevos_ejercicios || jsonb_build_array(nuevo_ejercicio);
      END LOOP;
      UPDATE rutinas_personalizadas SET ejercicios = nuevos_ejercicios WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

-- 5. Índice para queries más rápidas por nombre de ejercicio
CREATE INDEX IF NOT EXISTS idx_historial_ejercicio
ON historial_series(ejercicio);
