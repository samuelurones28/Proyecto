# 🚀 Mejoras del Coach de IA - AIFitnessCoach

## 📋 Resumen de Cambios

Se ha mejorado significativamente el prompt del Coach de IA y se han añadido nuevas funcionalidades para ofrecer una experiencia más personalizada, motivadora y segura.

---

## ✨ Nuevas Características

### 1. **Personalidad Mejorada**
- ✓ Tono motivacional e inspirador pero profesional
- ✓ Sin emojis excesivos (formal)
- ✓ Asume conocimiento técnico pero ofrece explicaciones si se solicita

### 2. **Contexto Ampliado**
El coach ahora tiene acceso a:
- ✓ **Lesiones/limitaciones** del usuario (campo `lesiones` en perfil)
- ✓ **Historial de entrenamientos** (últimas 4 semanas completadas)
- ✓ **Calendario de actividad** reciente
- ✓ **Historial de chat** aumentado de 8 a 20 mensajes

### 3. **Sistema de Excepciones Semanales** 🆕
- El usuario puede pedir cambios temporales: *"Esta semana solo puedo 3 días"*
- El coach crea un plan temporal **sin modificar el plan base**
- La siguiente semana, el usuario vuelve automáticamente a su rutina normal
- Nueva acción JSON: `EXCEPCION_SEMANAL`

### 4. **Validaciones de Seguridad**
- ✓ Advierte sobre ejercicios riesgosos para principiantes
- ✓ Valida volumen excesivo según nivel del usuario
- ✓ Aconseja sobre rutinas peligrosas (ej: 7 días consecutivos)
- ✓ Adapta ejercicios automáticamente si hay lesiones

### 5. **Educación y Progresión**
- ✓ Explica el "por qué" de sus decisiones al crear rutinas
- ✓ Proporciona tips de técnica automáticamente
- ✓ Menciona sobrecarga progresiva y cómo aumentar peso/reps
- ✓ Sugiere estrategias si detecta estancamiento en el historial

### 6. **Manejo Inteligente de Situaciones**
- ✓ Pregunta al usuario si escribe ejercicios mal: *"¿Con X te refieres a Y?"*
- ✓ Sugiere alternativas si falta equipamiento
- ✓ Confirma cambios de idea durante la entrevista
- ✓ Resumenes al final de cada modificación

---

## 🗄️ Cambios en Base de Datos

### Nuevos Campos Añadidos:

#### Tabla: `perfil`
```sql
- lesiones: TEXT (Lesiones o limitaciones físicas del usuario)
```

#### Tabla: `planes_semanales`
```sql
- es_temporal: BOOLEAN (Indica si es una excepción semanal)
- fecha_inicio: DATE (Fecha de inicio para planes temporales)
```

### Nueva Función SQL:
```sql
get_plan_activo(p_user_id, p_fecha)
```
Esta función prioriza planes temporales (excepciones semanales) si existen, de lo contrario devuelve el plan normal.

---

## 🛠️ Instrucciones de Instalación

### Paso 1: Aplicar Migración SQL

Ejecuta el script de migración en tu base de datos Supabase:

```bash
# Opción A: Usando Supabase CLI
supabase db push

# Opción B: Manual en Supabase Dashboard
# 1. Ve a tu proyecto en https://supabase.com
# 2. Ve a SQL Editor
# 3. Copia el contenido de: supabase/migrations/add_coach_improvements.sql
# 4. Ejecuta el script
```

### Paso 2: Verificar Cambios

Verifica que se aplicaron correctamente:

```sql
-- Verificar campo lesiones en perfil
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'perfil' AND column_name = 'lesiones';

-- Verificar campos en planes_semanales
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'planes_semanales'
AND column_name IN ('es_temporal', 'fecha_inicio');

-- Probar función get_plan_activo
SELECT * FROM get_plan_activo('tu-user-id-aqui', CURRENT_DATE);
```

### Paso 3: Reiniciar la App

```bash
# Detener el servidor
# Ctrl+C en la terminal

# Limpiar caché y reiniciar
npm start -- --clear
```

---

## 📝 Nuevas Acciones del Coach

### 1. ACTUALIZAR_PLAN (Ya existía, sin cambios)
Cambios permanentes al plan del usuario.

```json
{
  "accion": "ACTUALIZAR_PLAN",
  "datos": {
    "lunes": {
      "titulo": "Torso A",
      "ejercicios": [...]
    }
  }
}
```

### 2. EXCEPCION_SEMANAL 🆕 (Nueva)
Cambios temporales solo para esta semana.

```json
{
  "accion": "EXCEPCION_SEMANAL",
  "semana_inicio": "2026-02-04",
  "datos": {
    "lunes": {
      "titulo": "Fullbody Express",
      "ejercicios": [...]
    }
  }
}
```

### 3. BLOQUEAR_DIA (Ya existía, sin cambios)
Marcar un día específico como descanso.

```json
{
  "accion": "BLOQUEAR_DIA",
  "datos": {
    "fecha": "2026-02-05",
    "motivo": "Dolor rodilla"
  }
}
```

---

## 🧪 Casos de Uso de Prueba

### Caso 1: Crear Rutina Nueva
```
Usuario: "Quiero una rutina de 4 días para ganar músculo"
Coach: [Hace entrevista motivadora, explica por qué recomienda cada división]
```

### Caso 2: Excepción Semanal
```
Usuario: "Esta semana solo puedo entrenar lunes y miércoles"
Coach: "Entendido, solo para esta semana, ¿correcto? [Explica ajuste temporal]"
[Genera EXCEPCION_SEMANAL sin tocar el plan base]
```

### Caso 3: Validación de Seguridad
```
Usuario: "Quiero entrenar 7 días seguidos"
Coach: "Recuerda que el músculo crece en el descanso. Considera al menos 1-2 días off para optimizar resultados."
```

### Caso 4: Adaptación por Lesión
```
Usuario (con lesión de rodilla en perfil): "Dame una rutina de piernas"
Coach: "Dado tu problema de rodilla, voy a priorizar ejercicios de bajo impacto como [...]"
```

---

## 📊 Estructura del Nuevo Prompt

El prompt sigue este flujo:

1. **Contexto del Usuario** (perfil, plan, historial, lesiones)
2. **Análisis de Intención** (¿qué quiere hacer?)
3. **Modo Creación** (rutina nueva con entrevista)
4. **Modo Modificación** (cambios permanentes)
5. **Modo Excepción Semanal** 🆕 (cambios temporales)
6. **Modo Excepción Puntual** (un solo día)
7. **Validaciones de Seguridad**
8. **Formatos JSON** para cada acción
9. **Principios de Comunicación**
10. **Progresión y Educación**

---

## 🔍 Archivos Modificados

```
app/(tabs)/index.tsx          - Chat del coach (prompt y lógica)
supabase/migrations/          - Script SQL con las migraciones
MEJORAS_COACH_IA.md          - Este archivo (documentación)
```

---

## 🐛 Troubleshooting

### Error: "function get_plan_activo does not exist"
**Solución:** La migración SQL no se aplicó. Ejecuta manualmente el script en Supabase Dashboard.

### El coach no usa el historial reciente
**Solución:** Verifica que tienes entrenamientos completados en `calendario_acciones` con `estado='completado'`.

### Las excepciones semanales no funcionan
**Solución:** Verifica que los campos `es_temporal` y `fecha_inicio` existen en `planes_semanales`.

---

## 📈 Próximas Mejoras (Futuro)

- [ ] Integrar análisis de volumen semanal para sugerir deloads
- [ ] Sistema de recomendaciones basado en progreso histórico
- [ ] Exportar rutinas a PDF
- [ ] Notificaciones inteligentes basadas en adherencia

---

## 💬 Feedback

Si encuentras algún problema o tienes sugerencias, por favor:
1. Revisa la consola del navegador en caso de errores
2. Verifica los logs de Supabase
3. Documenta el comportamiento esperado vs. obtenido

---

**Fecha de implementación:** 2026-02-04
**Versión:** 2.0.0
