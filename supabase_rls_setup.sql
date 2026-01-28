-- =====================================================
-- SCRIPT DE CONFIGURACIÓN DE ROW LEVEL SECURITY (RLS)
-- Para AIFitnessCoach - Supabase
-- =====================================================
--
-- IMPORTANTE: Ejecutar este script en el SQL Editor de Supabase
-- Dashboard > SQL Editor > New Query > Pegar y ejecutar
--
-- Este script:
-- 1. Añade columna user_id a todas las tablas (si no existe)
-- 2. Habilita RLS en todas las tablas
-- 3. Crea políticas para que cada usuario solo vea sus datos
-- =====================================================

-- =====================================================
-- PASO 1: Añadir columna user_id a las tablas
-- =====================================================

-- Tabla: perfil
ALTER TABLE perfil
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: mediciones
ALTER TABLE mediciones
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: planes_semanales
ALTER TABLE planes_semanales
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: calendario_acciones
ALTER TABLE calendario_acciones
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: comidas (diario_alimentos)
ALTER TABLE comidas
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: historial_entrenamientos
ALTER TABLE historial_entrenamientos
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: historial_series
ALTER TABLE historial_series
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tabla: rutinas_personalizadas
ALTER TABLE rutinas_personalizadas
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- =====================================================
-- PASO 2: Habilitar Row Level Security
-- =====================================================

ALTER TABLE perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE mediciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE planes_semanales ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendario_acciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE comidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_entrenamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE rutinas_personalizadas ENABLE ROW LEVEL SECURITY;

-- Catálogo de ejercicios es público (solo lectura)
ALTER TABLE catalogo_ejercicios ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 3: Crear políticas de seguridad
-- =====================================================

-- Eliminar políticas existentes (si las hay)
DROP POLICY IF EXISTS "Users can view own perfil" ON perfil;
DROP POLICY IF EXISTS "Users can insert own perfil" ON perfil;
DROP POLICY IF EXISTS "Users can update own perfil" ON perfil;
DROP POLICY IF EXISTS "Users can delete own perfil" ON perfil;

DROP POLICY IF EXISTS "Users can view own mediciones" ON mediciones;
DROP POLICY IF EXISTS "Users can insert own mediciones" ON mediciones;
DROP POLICY IF EXISTS "Users can update own mediciones" ON mediciones;
DROP POLICY IF EXISTS "Users can delete own mediciones" ON mediciones;

DROP POLICY IF EXISTS "Users can view own planes" ON planes_semanales;
DROP POLICY IF EXISTS "Users can insert own planes" ON planes_semanales;
DROP POLICY IF EXISTS "Users can update own planes" ON planes_semanales;
DROP POLICY IF EXISTS "Users can delete own planes" ON planes_semanales;

DROP POLICY IF EXISTS "Users can view own calendario" ON calendario_acciones;
DROP POLICY IF EXISTS "Users can insert own calendario" ON calendario_acciones;
DROP POLICY IF EXISTS "Users can update own calendario" ON calendario_acciones;
DROP POLICY IF EXISTS "Users can delete own calendario" ON calendario_acciones;

DROP POLICY IF EXISTS "Users can view own comidas" ON comidas;
DROP POLICY IF EXISTS "Users can insert own comidas" ON comidas;
DROP POLICY IF EXISTS "Users can update own comidas" ON comidas;
DROP POLICY IF EXISTS "Users can delete own comidas" ON comidas;

DROP POLICY IF EXISTS "Users can view own historial_entrenamientos" ON historial_entrenamientos;
DROP POLICY IF EXISTS "Users can insert own historial_entrenamientos" ON historial_entrenamientos;
DROP POLICY IF EXISTS "Users can delete own historial_entrenamientos" ON historial_entrenamientos;

DROP POLICY IF EXISTS "Users can view own historial_series" ON historial_series;
DROP POLICY IF EXISTS "Users can insert own historial_series" ON historial_series;
DROP POLICY IF EXISTS "Users can delete own historial_series" ON historial_series;

DROP POLICY IF EXISTS "Users can view own rutinas" ON rutinas_personalizadas;
DROP POLICY IF EXISTS "Users can insert own rutinas" ON rutinas_personalizadas;
DROP POLICY IF EXISTS "Users can update own rutinas" ON rutinas_personalizadas;
DROP POLICY IF EXISTS "Users can delete own rutinas" ON rutinas_personalizadas;

DROP POLICY IF EXISTS "Anyone can read catalogo" ON catalogo_ejercicios;

-- =====================================================
-- POLÍTICAS PARA: perfil
-- =====================================================
CREATE POLICY "Users can view own perfil" ON perfil
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own perfil" ON perfil
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own perfil" ON perfil
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own perfil" ON perfil
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS PARA: mediciones
-- =====================================================
CREATE POLICY "Users can view own mediciones" ON mediciones
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mediciones" ON mediciones
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mediciones" ON mediciones
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mediciones" ON mediciones
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS PARA: planes_semanales
-- =====================================================
CREATE POLICY "Users can view own planes" ON planes_semanales
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own planes" ON planes_semanales
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own planes" ON planes_semanales
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own planes" ON planes_semanales
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS PARA: calendario_acciones
-- =====================================================
CREATE POLICY "Users can view own calendario" ON calendario_acciones
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendario" ON calendario_acciones
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendario" ON calendario_acciones
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendario" ON calendario_acciones
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS PARA: comidas
-- =====================================================
CREATE POLICY "Users can view own comidas" ON comidas
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own comidas" ON comidas
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comidas" ON comidas
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comidas" ON comidas
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS PARA: historial_entrenamientos
-- =====================================================
CREATE POLICY "Users can view own historial_entrenamientos" ON historial_entrenamientos
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own historial_entrenamientos" ON historial_entrenamientos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own historial_entrenamientos" ON historial_entrenamientos
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS PARA: historial_series
-- =====================================================
CREATE POLICY "Users can view own historial_series" ON historial_series
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own historial_series" ON historial_series
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own historial_series" ON historial_series
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS PARA: rutinas_personalizadas
-- =====================================================
CREATE POLICY "Users can view own rutinas" ON rutinas_personalizadas
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rutinas" ON rutinas_personalizadas
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rutinas" ON rutinas_personalizadas
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rutinas" ON rutinas_personalizadas
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS PARA: catalogo_ejercicios (público, solo lectura)
-- =====================================================
CREATE POLICY "Anyone can read catalogo" ON catalogo_ejercicios
    FOR SELECT USING (true);

-- =====================================================
-- PASO 4: Crear índices para mejorar rendimiento
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_perfil_user_id ON perfil(user_id);
CREATE INDEX IF NOT EXISTS idx_mediciones_user_id ON mediciones(user_id);
CREATE INDEX IF NOT EXISTS idx_planes_semanales_user_id ON planes_semanales(user_id);
CREATE INDEX IF NOT EXISTS idx_calendario_acciones_user_id ON calendario_acciones(user_id);
CREATE INDEX IF NOT EXISTS idx_comidas_user_id ON comidas(user_id);
CREATE INDEX IF NOT EXISTS idx_historial_entrenamientos_user_id ON historial_entrenamientos(user_id);
CREATE INDEX IF NOT EXISTS idx_historial_series_user_id ON historial_series(user_id);
CREATE INDEX IF NOT EXISTS idx_rutinas_personalizadas_user_id ON rutinas_personalizadas(user_id);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Ejecuta esta consulta para verificar que RLS está habilitado:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public';
--
-- =====================================================

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Row Level Security configurado correctamente para AIFitnessCoach';
END $$;
