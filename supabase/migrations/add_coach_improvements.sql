-- Mejoras del Coach de IA
-- Fecha: 2026-02-04
-- Descripción: Añade campos para soportar excepciones semanales y lesiones

-- 1. Añadir campo de lesiones en la tabla perfil (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'perfil' AND column_name = 'lesiones'
    ) THEN
        ALTER TABLE perfil ADD COLUMN lesiones TEXT;
        COMMENT ON COLUMN perfil.lesiones IS 'Lesiones o limitaciones físicas del usuario';
    END IF;
END $$;

-- 2. Añadir campos para planes temporales (excepciones semanales)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'planes_semanales' AND column_name = 'es_temporal'
    ) THEN
        ALTER TABLE planes_semanales ADD COLUMN es_temporal BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN planes_semanales.es_temporal IS 'Indica si es una excepción semanal temporal';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'planes_semanales' AND column_name = 'fecha_inicio'
    ) THEN
        ALTER TABLE planes_semanales ADD COLUMN fecha_inicio DATE;
        COMMENT ON COLUMN planes_semanales.fecha_inicio IS 'Fecha de inicio para planes temporales';
    END IF;
END $$;

-- 3. Crear índice para mejorar queries de planes temporales
CREATE INDEX IF NOT EXISTS idx_planes_semanales_temporal
ON planes_semanales(user_id, es_temporal, fecha_inicio)
WHERE es_temporal = true;

-- 4. Crear función para obtener el plan activo (considerando excepciones semanales)
CREATE OR REPLACE FUNCTION get_plan_activo(p_user_id UUID, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
    id INT,
    user_id UUID,
    nombre TEXT,
    datos_semana JSONB,
    es_temporal BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Primero buscar si hay una excepción semanal activa
    RETURN QUERY
    SELECT
        ps.id,
        ps.user_id,
        ps.nombre,
        ps.datos_semana,
        ps.es_temporal,
        ps.created_at
    FROM planes_semanales ps
    WHERE ps.user_id = p_user_id
        AND ps.es_temporal = true
        AND ps.fecha_inicio IS NOT NULL
        AND p_fecha >= ps.fecha_inicio
        AND p_fecha < ps.fecha_inicio + INTERVAL '7 days'
    ORDER BY ps.created_at DESC
    LIMIT 1;

    -- Si no hay excepción, devolver el plan normal más reciente
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            ps.id,
            ps.user_id,
            ps.nombre,
            ps.datos_semana,
            ps.es_temporal,
            ps.created_at
        FROM planes_semanales ps
        WHERE ps.user_id = p_user_id
            AND (ps.es_temporal = false OR ps.es_temporal IS NULL)
        ORDER BY ps.created_at DESC
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Comentarios adicionales
COMMENT ON FUNCTION get_plan_activo IS 'Obtiene el plan activo del usuario, priorizando excepciones semanales si existen';
