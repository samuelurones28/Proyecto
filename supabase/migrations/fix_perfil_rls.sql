-- Migracion para corregir las politicas RLS de la tabla perfil
-- Ejecutar en Supabase SQL Editor: https://supabase.com/dashboard/project/fchlslsvtghfgwyikfgo/sql

-- 1. Verificar que la columna onboarding_completado existe
ALTER TABLE public.perfil
ADD COLUMN IF NOT EXISTS onboarding_completado BOOLEAN DEFAULT false;

-- 2. Verificar que RLS esta habilitado (si no lo esta, habilitarlo)
ALTER TABLE public.perfil ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar politicas existentes que puedan estar causando conflictos
DROP POLICY IF EXISTS "Allow public access to perfil" ON public.perfil;
DROP POLICY IF EXISTS "Allow all operations on perfil" ON public.perfil;

-- 4. Crear politica que permite todas las operaciones
-- NOTA: Esta politica es para DESARROLLO. En produccion, implementar autenticacion
-- y usar politicas basadas en auth.uid()
CREATE POLICY "Allow all operations on perfil" ON public.perfil
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Hacer lo mismo para la tabla mediciones (tambien usada en onboarding)
ALTER TABLE public.mediciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on mediciones" ON public.mediciones;

CREATE POLICY "Allow all operations on mediciones" ON public.mediciones
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- IMPORTANTE: Para produccion, reemplazar estas politicas por:
/*
-- Politica basada en autenticacion
CREATE POLICY "Users can manage their own profile" ON public.perfil
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
*/
