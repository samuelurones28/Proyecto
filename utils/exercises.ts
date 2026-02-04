// utils/exercises.ts
// Normalización de nombres de ejercicios para consistencia en historial y progreso

const PREPOSICIONES = new Set(['de', 'del', 'con', 'a', 'la', 'el', 'en', 'y', 'e', 'al']);

/**
 * Normaliza un nombre de ejercicio: trim, colapsar espacios, Title Case español
 */
export function normalizarNombreEjercicio(nombre: string): string {
  if (!nombre || !nombre.trim()) return 'Ejercicio';

  const limpio = nombre
    .trim()
    .replace(/[.,;:!?]+$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const palabras = limpio.split(' ').map((p, i) => {
    if (i === 0 || !PREPOSICIONES.has(p)) {
      return p.charAt(0).toUpperCase() + p.slice(1);
    }
    return p;
  });

  return palabras.join(' ');
}

function getBigrams(str: string): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.push(str.substring(i, i + 2));
  }
  return bigrams;
}

function diceCoefficient(a: string, b: string): number {
  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);
  if (bigramsA.length === 0 && bigramsB.length === 0) return 1;
  if (bigramsA.length === 0 || bigramsB.length === 0) return 0;

  const setB = new Set(bigramsB);
  let intersection = 0;
  for (const bg of bigramsA) {
    if (setB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.length + bigramsB.length);
}

/**
 * Busca en el catálogo un ejercicio con nombre similar.
 * Devuelve el nombre canónico del catálogo si hay coincidencia, o null.
 */
export function buscarCoincidenciaCatalogo(
  nombre: string,
  catalogo: Array<{ nombre: string }>
): string | null {
  if (!catalogo || catalogo.length === 0) return null;

  const normalizado = normalizarNombreEjercicio(nombre).toLowerCase();

  // Match exacto (case-insensitive)
  const exacto = catalogo.find(c => c.nombre.toLowerCase() === normalizado);
  if (exacto) return exacto.nombre;

  let mejorScore = 0;
  let mejorNombre: string | null = null;

  for (const item of catalogo) {
    const catalogoNorm = item.nombre.toLowerCase();

    // Contención: uno contiene al otro
    if (normalizado.includes(catalogoNorm) || catalogoNorm.includes(normalizado)) {
      const ratio = Math.min(normalizado.length, catalogoNorm.length)
                  / Math.max(normalizado.length, catalogoNorm.length);
      if (ratio >= 0.7) return item.nombre;
    }

    // Dice coefficient
    const score = diceCoefficient(normalizado, catalogoNorm);
    if (score > mejorScore) {
      mejorScore = score;
      mejorNombre = item.nombre;
    }
  }

  return mejorScore >= 0.65 ? mejorNombre : null;
}

/**
 * Normaliza un nombre y lo matchea contra el catálogo si es posible.
 */
export function normalizarEjercicioConCatalogo(
  nombre: string,
  catalogo: Array<{ nombre: string }>
): string {
  const normalizado = normalizarNombreEjercicio(nombre);
  if (!catalogo || catalogo.length === 0) return normalizado;

  const coincidencia = buscarCoincidenciaCatalogo(normalizado, catalogo);
  return coincidencia || normalizado;
}

/**
 * Recorre la estructura de un plan semanal y normaliza todos los nombres de ejercicios.
 * Estructura esperada: { lunes: { titulo, ejercicios: [{ nombre, ... }] }, ... }
 */
export function normalizarNombresEnPlan(
  datos: Record<string, any>,
  catalogo: Array<{ nombre: string }>
): Record<string, any> {
  if (!datos) return datos;

  const resultado = { ...datos };
  for (const dia of Object.keys(resultado)) {
    if (resultado[dia]?.ejercicios && Array.isArray(resultado[dia].ejercicios)) {
      resultado[dia] = {
        ...resultado[dia],
        ejercicios: resultado[dia].ejercicios.map((ej: any) => ({
          ...ej,
          nombre: normalizarEjercicioConCatalogo(
            ej.nombre || ej.name || 'Ejercicio',
            catalogo
          )
        }))
      };
    }
  }
  return resultado;
}
