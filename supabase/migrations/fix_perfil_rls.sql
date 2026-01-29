-- Migracion para corregir las politicas RLS de las tablas existentes
-- Ejecutar en Supabase SQL Editor: https://supabase.com/dashboard/project/fchlslsvtghfgwyikfgo/sql

-- =====================================================
-- TABLA: perfil
-- =====================================================
ALTER TABLE public.perfil
ADD COLUMN IF NOT EXISTS onboarding_completado BOOLEAN DEFAULT false;

ALTER TABLE public.perfil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access to perfil" ON public.perfil;
DROP POLICY IF EXISTS "Allow all operations on perfil" ON public.perfil;

CREATE POLICY "Allow all operations on perfil" ON public.perfil
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TABLA: mediciones
-- =====================================================
ALTER TABLE public.mediciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on mediciones" ON public.mediciones;

CREATE POLICY "Allow all operations on mediciones" ON public.mediciones
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TABLA: rutinas_personalizadas
-- =====================================================
ALTER TABLE public.rutinas_personalizadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on rutinas_personalizadas" ON public.rutinas_personalizadas;

CREATE POLICY "Allow all operations on rutinas_personalizadas" ON public.rutinas_personalizadas
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TABLA: planes_semanales
-- =====================================================
ALTER TABLE public.planes_semanales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on planes_semanales" ON public.planes_semanales;

CREATE POLICY "Allow all operations on planes_semanales" ON public.planes_semanales
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TABLA: catalogo_ejercicios
-- =====================================================
ALTER TABLE public.catalogo_ejercicios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on catalogo_ejercicios" ON public.catalogo_ejercicios;

CREATE POLICY "Allow all operations on catalogo_ejercicios" ON public.catalogo_ejercicios
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TABLA: historial_series
-- =====================================================
ALTER TABLE public.historial_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on historial_series" ON public.historial_series;

CREATE POLICY "Allow all operations on historial_series" ON public.historial_series
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TABLA: calendario_acciones
-- =====================================================
ALTER TABLE public.calendario_acciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on calendario_acciones" ON public.calendario_acciones;

CREATE POLICY "Allow all operations on calendario_acciones" ON public.calendario_acciones
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TABLA: comidas (diario_alimentos)
-- =====================================================
ALTER TABLE public.comidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on comidas" ON public.comidas;

CREATE POLICY "Allow all operations on comidas" ON public.comidas
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- IMPORTANTE: Para produccion, implementar autenticacion
-- y reemplazar estas politicas por unas basadas en auth.uid()
-- =====================================================
