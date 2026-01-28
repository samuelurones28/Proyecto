# CLAUDE.md - AIFitnessCoach

## Resumen del Proyecto

AIFitnessCoach es una aplicación móvil de fitness con IA construida con **React Native + Expo** para iOS/Android. Integra:
- Coach de IA conversacional (Groq LLM)
- Gestión de rutinas de entrenamiento
- Diario nutricional con análisis de imágenes
- Seguimiento de progreso (peso, grasa, músculo)
- Calendario de planificación

---

## Estructura del Proyecto

```
AIFitnessCoach/
└── AIFitnessCoach/           # Proyecto principal (carpeta anidada)
    ├── app/                  # Pantallas (Expo Router)
    │   ├── _layout.tsx       # Layout raíz con providers
    │   └── (tabs)/           # Navegación por tabs
    │       ├── index.tsx     # Chat con Coach IA
    │       ├── rutinas.tsx   # Gestión de entrenamientos
    │       ├── nutricion.tsx # Diario alimenticio
    │       ├── progreso.tsx  # Gráficas de evolución
    │       ├── perfil.tsx    # Configuración usuario
    │       └── calendario.tsx# Planificación semanal
    │
    ├── components/           # Componentes reutilizables
    │   ├── WorkoutContext.tsx# Estado global de rutina activa
    │   ├── ThemeContext.tsx  # Gestión de tema claro/oscuro
    │   └── BarcodeScanner.tsx# Escáner de códigos de barras
    │
    ├── hooks/                # Hooks personalizados
    ├── constants/            # Constantes (colores, fuentes)
    ├── config.js             # Exporta API keys desde env vars
    ├── supabase.js           # Cliente Supabase (usa env vars)
    ├── .env                  # Variables de entorno (NO SUBIR)
    └── .env.example          # Plantilla para .env
```

---

## Comandos de Desarrollo

```bash
# Navegar al proyecto
cd AIFitnessCoach/AIFitnessCoach

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm start

# Ejecutar en iOS
npm run ios

# Ejecutar en Android
npm run android

# Lint del código
npm run lint
```

---

## Stack Tecnológico

| Categoría | Tecnología |
|-----------|-----------|
| Framework | Expo ~54.0.31 + React Native 0.81.5 |
| Navegación | Expo Router ~6.0.21 |
| Lenguaje | TypeScript ~5.9.2 |
| Base de datos | Supabase (PostgreSQL) |
| IA/LLM | Groq (llama-3.3-70b-versatile) |
| Visión IA | Groq Vision (llama-3.2-11b-vision-preview) |
| Gráficas | react-native-chart-kit |
| Calendario | react-native-calendars |

---

## ERRORES CRÍTICOS IDENTIFICADOS

### 1. ~~SEGURIDAD: API Keys Expuestas en Código Fuente~~ RESUELTO

**Estado: CORREGIDO**

Las claves de API ahora se cargan desde variables de entorno (`.env`).

**Archivos actualizados:**
- `config.js` - Usa `process.env.EXPO_PUBLIC_*`
- `supabase.js` - Usa `process.env.EXPO_PUBLIC_SUPABASE_*`
- `app/(tabs)/index.tsx` - Usa `process.env.EXPO_PUBLIC_GROQ_API_KEY`
- `app/(tabs)/nutricion.tsx` - Usa `process.env.EXPO_PUBLIC_GROQ_API_KEY`
- `app/(tabs)/calendario.tsx` - Usa `process.env.EXPO_PUBLIC_GROQ_API_KEY`
- `app/(tabs)/rutinas.tsx` - Usa `process.env.EXPO_PUBLIC_RAPIDAPI_KEY`

**Configuración:**
```bash
# Copiar plantilla y añadir tus claves
cp .env.example .env
```

```env
# .env
EXPO_PUBLIC_GROQ_API_KEY=gsk_xxx
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
EXPO_PUBLIC_GEMINI_API_KEY=AIzaxxx
```

```typescript
// Uso en código
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
```

### 2. API Key de RapidAPI No Configurada

**Archivo:** `rutinas.tsx:21`
```typescript
const RAPID_API_KEY = "TU_CLAVE_DE_RAPIDAPI_AQUI"; // <- No funcional
```

La búsqueda de ejercicios en ExerciseDB no funcionará hasta que se configure.

### 3. Duplicación de API Keys

La clave de Groq está definida en **4 archivos diferentes** en lugar de importarse desde un único lugar (`config.js`).

---

## ERRORES DE CÓDIGO

### 4. Dependencias Incorrectas en useEffect/useFocusEffect

**Archivo:** `index.tsx:63-67`
```typescript
useFocusEffect(
    useCallback(() => {
        cargarContexto();
    }, []) // <- Falta cargarContexto en dependencias
);
```

**Archivos afectados:**
- `index.tsx:63-67`
- `rutinas.tsx:101`
- `nutricion.tsx:52`
- `progreso.tsx:67-71`
- `perfil.tsx:48-52`
- `calendario.tsx:54-58`

**Impacto:** Puede causar comportamiento inesperado si las funciones cambian.

### 5. ThemeContext Inicialización Incorrecta

**Archivo:** `ThemeContext.tsx:19-22`
```typescript
useEffect(() => {
    const current = Appearance.getColorScheme();
    setTheme(current || 'system'); // <- Lee sistema, ignora tema guardado
}, []);
```

**Problema:** Al montar, siempre usa el tema del sistema en lugar del tema guardado en Supabase.

### 6. Memory Leaks Potenciales

**Archivo:** `rutinas.tsx:211-222`
```typescript
descansoIntervalRef.current = setInterval(() => {
    // ...
    if (left <= 0) {
        if (descansoIntervalRef.current) clearInterval(descansoIntervalRef.current);
        finalizarDescanso(); // <- Puede causar actualizaciones de estado en componente desmontado
    }
}, 250);
```

**Problema:** No hay verificación de si el componente está montado antes de actualizar estado.

### 7. Mutación de Estado Potencial

**Archivo:** `rutinas.tsx:452-454`
```typescript
const copia = { ...rutinaActiva };
copia.ejercicios.push(nuevo); // <- Muta el array original
setRutinaActiva(copia);
```

**Solución:**
```typescript
const copia = {
    ...rutinaActiva,
    ejercicios: [...rutinaActiva.ejercicios, nuevo]
};
setRutinaActiva(copia);
```

### 8. Tipado Inconsistente

**Problema:** Mezcla de TypeScript y JavaScript, uso excesivo de `any`:

| Archivo | Problema |
|---------|----------|
| `WorkoutContext.tsx:4` | `rutinaActiva: any \| null` |
| `WorkoutContext.tsx:15` | `setRutinaActiva: React.Dispatch<any>` |
| `perfil.tsx` | Parámetros sin tipo en funciones |
| `calendario.tsx` | `getStyles(colores)` sin tipo para `colores` |

---

## PROBLEMAS DE OPTIMIZACIÓN

### 9. Estilos Recreados en Cada Render

**Archivos afectados:** `index.tsx`, `perfil.tsx`, `calendario.tsx`, `progreso.tsx`

```typescript
// PROBLEMA: getStyles se llama en cada render
const styles = getStyles(colores);
```

**Solución:** Usar `useMemo`:
```typescript
const styles = useMemo(() => getStyles(colores), [colores]);
```

### 10. Funciones No Memorizadas

**Problema:** Funciones definidas dentro del componente se recrean en cada render.

**Solución:** Usar `useCallback` para funciones pasadas como props o usadas en efectos:
```typescript
const enviarMensaje = useCallback(async () => {
    // ...
}, [input, perfil, plan]);
```

### 11. Código de Colores Duplicado

La lógica de colores se repite en **CADA pantalla**:

```typescript
// Se repite en 6+ archivos
const esOscuro = theme === 'dark' ? true : theme === 'light' ? false : systemScheme === 'dark';
const colores = {
    fondo: esOscuro ? '#000000' : '#f2f2f7',
    // ... 10+ líneas más
};
```

**Solución:** Crear un hook personalizado `useAppColors()`.

### 12. Consultas Secuenciales que Podrían ser Paralelas

**Archivo:** `rutinas.tsx:352-360`
```typescript
// PROBLEMA: Consultas secuenciales en un loop
for (const nombre of nombres) {
    const { data: ultFechas } = await supabase...
    if (ultFechas && ultFechas.length > 0) {
        const { data: seriesPrevias } = await supabase...
    }
}
```

**Solución:** Usar `Promise.all`:
```typescript
const resultados = await Promise.all(
    nombres.map(nombre => cargarHistorialEjercicio(nombre))
);
```

---

## PROBLEMAS DE ARQUITECTURA

### 13. No Hay Sistema de Autenticación

**Impacto:** Todos los datos son públicos. Cualquiera con la URL de Supabase y la anon key puede leer/escribir datos.

**Solución:** Implementar autenticación con Supabase Auth y Row Level Security (RLS).

### 14. No Hay Manejo de Errores Consistente

**Problema:** Algunos errores muestran Alert, otros solo `console.error`:

```typescript
// Inconsistencia:
} catch (e) { console.error(e); }  // Solo log
} catch (e) { Alert.alert("Error", e.message); }  // Alerta
```

**Solución:** Crear un sistema centralizado de manejo de errores.

### 15. No Hay Validación de Datos

**Problema:** Los datos del usuario no se validan antes de enviar a la API:
- Calorías negativas podrían guardarse
- Pesos/mediciones sin límites razonables
- Inputs de texto sin sanitización

---

## FUNCIONALIDADES ACTUALES (NO ELIMINAR)

1. **Chat con Coach IA**
   - Conversación natural para crear/modificar rutinas
   - Sistema de comandos JSON para acciones
   - Historial de chat

2. **Gestión de Rutinas**
   - Plan semanal generado por IA
   - Rutinas personalizadas
   - Timer de entrenamiento global
   - Timer de descanso entre series
   - Historial de pesos por ejercicio
   - Estadísticas y gráficas por ejercicio

3. **Nutrición**
   - Análisis de fotos con IA (Groq Vision)
   - Escáner de códigos de barras
   - Cálculo automático de macros
   - Metas dinámicas según perfil

4. **Progreso**
   - Gráficas de peso, grasa, músculo
   - Filtros temporales (1M, 1Y)
   - Historial completo

5. **Calendario**
   - Vista mensual con estados
   - Marcado de días completados
   - Gestión de descansos manuales

6. **Perfil**
   - Datos físicos del usuario
   - Objetivos (definición/recomp/volumen)
   - Nivel de actividad
   - Días no disponibles
   - Selector de tema

---

## TABLAS DE SUPABASE

```sql
-- Tablas identificadas en el código:
perfil
mediciones
planes_semanales
calendario_acciones
comidas (diario_alimentos)
historial_entrenamientos
historial_series
rutinas_personalizadas
catalogo_ejercicios
```

---

## PRÓXIMOS PASOS RECOMENDADOS

### Prioridad ALTA (Seguridad)
1. [x] ~~Mover todas las API keys a variables de entorno (.env)~~ **COMPLETADO**
2. [ ] Implementar autenticación de usuarios
3. [ ] Configurar Row Level Security en Supabase

### Prioridad MEDIA (Bugs)
4. [ ] Corregir dependencias de useEffect/useFocusEffect
5. [ ] Arreglar inicialización de ThemeContext
6. [ ] Configurar API key de RapidAPI (ExerciseDB) - *ya usa env var, solo falta obtener clave*
7. [x] ~~Centralizar claves API en un solo archivo~~ **COMPLETADO** (config.js + .env)

### Prioridad NORMAL (Optimización)
8. [ ] Crear hook `useAppColors()` para evitar duplicación
9. [ ] Memoizar estilos con useMemo
10. [ ] Memoizar funciones con useCallback
11. [ ] Paralelizar consultas de Supabase
12. [ ] Mejorar tipado TypeScript (eliminar `any`)

### Prioridad BAJA (Mejoras)
13. [ ] Sistema centralizado de manejo de errores
14. [ ] Validación de inputs del usuario
15. [ ] Tests unitarios y de integración
16. [ ] Documentación de API

---

## NOTAS PARA DESARROLLO

### Ejecutar la App

```bash
cd AIFitnessCoach/AIFitnessCoach
npm start
# Presionar 'i' para iOS o 'a' para Android
```

### Agregar Nueva Pantalla

1. Crear archivo en `app/(tabs)/nueva-pantalla.tsx`
2. Agregar tab en `app/(tabs)/_layout.tsx`
3. Seguir patrón de las pantallas existentes para tema/colores

### Modificar Esquema de Colores

Editar `constants/theme.ts` y actualizar todos los archivos que usan `getStyles()`.

### Agregar Nuevo Modelo de IA

1. Actualizar `config.js` con la nueva API key
2. Crear función de llamada en el archivo correspondiente
3. Seguir patrón de `enviarMensaje()` en `index.tsx`

---

## CONTACTO Y RECURSOS

- **Supabase Dashboard:** https://supabase.com/dashboard/project/fchlslsvtghfgwyikfgo
- **Groq Console:** https://console.groq.com
- **Expo Docs:** https://docs.expo.dev
