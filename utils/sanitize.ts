// utils/sanitize.ts
// Módulo de sanitización para queries de Supabase

/**
 * Sanitiza texto para búsquedas en Supabase
 * Elimina caracteres especiales que podrían causar problemas en queries
 */
export const sanitizeSearchText = (text: string): string => {
  if (!text) return '';

  // Eliminar caracteres especiales de SQL/texto
  return text
    .trim()
    .replace(/['"\\;%_]/g, '') // Eliminar comillas, backslash, punto y coma, % y _
    .replace(/\s+/g, ' ')       // Normalizar espacios
    .substring(0, 100);         // Limitar longitud
};

/**
 * Sanitiza texto para búsqueda fulltext en Supabase
 * Escapa caracteres especiales para textSearch
 */
export const sanitizeFullTextSearch = (text: string): string => {
  if (!text) return '';

  // Escapar caracteres especiales de fulltext search
  return text
    .trim()
    .replace(/['"\\;%_&|!():*]/g, '') // Eliminar caracteres especiales de FTS
    .replace(/\s+/g, ' ')
    .substring(0, 100);
};

/**
 * Sanitiza texto para ILIKE queries
 * Escapa caracteres especiales de patrón
 */
export const sanitizeILike = (text: string): string => {
  if (!text) return '';

  // Escapar caracteres especiales de LIKE: % y _
  return text
    .trim()
    .replace(/[%_\\]/g, '') // Eliminar wildcards y backslash
    .substring(0, 100);
};

/**
 * Valida y sanitiza un UUID
 */
export const sanitizeUUID = (uuid: string): string | null => {
  if (!uuid) return null;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cleaned = uuid.trim().toLowerCase();

  if (!uuidRegex.test(cleaned)) return null;
  return cleaned;
};

/**
 * Sanitiza un ID numérico
 */
export const sanitizeNumericId = (id: string | number): number | null => {
  const num = typeof id === 'string' ? parseInt(id, 10) : id;
  if (isNaN(num) || num < 1) return null;
  return num;
};

/**
 * Sanitiza una fecha ISO
 */
export const sanitizeISODate = (date: string): string | null => {
  if (!date) return null;

  // Verificar formato ISO básico
  const isoRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  if (!isoRegex.test(date)) return null;

  // Verificar que sea una fecha válida
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return null;

  return date;
};
