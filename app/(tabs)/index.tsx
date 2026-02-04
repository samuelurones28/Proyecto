import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import ReactMarkdown from 'react-native-markdown-display';
import { useAuth } from '../../components/AuthContext';
import { useWorkout } from '../../components/WorkoutContext';
import { useAppColors } from '../../hooks/useAppColors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GROQ_API_KEY, GROQ_MODEL } from '../../config';
import { normalizarNombresEnPlan } from '../../utils/exercises';

export default function ChatScreen() {
  const { user } = useAuth();
  const { rutinaActiva } = useWorkout();
  const { esOscuro, colores } = useAppColors();
  const [mensajes, setMensajes] = useState([
    { id: 1, texto: "⚡ Hola. Soy tu Arquitecto Fitness. ¿Creamos una rutina nueva o ajustamos la actual?", esUsuario: false }
  ]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalInfoVisible, setModalInfoVisible] = useState(false);
  const scrollViewRef = useRef(null);

  // Contexto en tiempo real
  const [perfil, setPerfil] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [historialReciente, setHistorialReciente] = useState<Array<{fecha: string, estado: string}>>([]);
  const [catalogoEjercicios, setCatalogoEjercicios] = useState<Array<{nombre: string}>>([]);

  const getStyles = (colores) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colores.fondo },
    header: { padding: 15, backgroundColor: colores.tarjeta, borderBottomWidth: 1, borderColor: colores.borde, flexDirection:'row', justifyContent:'space-between', alignItems: 'center' },
    titulo: { fontSize: 18, fontWeight: 'bold', color: colores.texto },
    chatArea: { flex: 1, padding: 15 },
    burbuja: { maxWidth: '85%', padding: 12, borderRadius: 18, marginBottom: 10 },
    burbujaUsuario: { backgroundColor: '#007AFF', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
    burbujaIA: { backgroundColor: colores.tarjeta, alignSelf: 'flex-start', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: colores.borde },
    textoUsuario: { color: 'white', fontSize: 16 },
    inputArea: { flexDirection: 'row', padding: 10, backgroundColor: colores.tarjeta, alignItems: 'center', gap: 10, borderTopWidth:1, borderColor: colores.borde },
    input: { flex: 1, backgroundColor: colores.inputBg, padding: 10, borderRadius: 20, fontSize: 16, maxHeight: 100, color: colores.texto },
    btnEnviar: { backgroundColor: '#007AFF', width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: colores.tarjeta, width: '80%', padding: 20, borderRadius: 15, alignItems:'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: colores.texto },
    modalText: { fontSize: 14, color: colores.subtexto, lineHeight: 22, textAlign: 'left', marginBottom: 20 },
    btnCerrar: { backgroundColor: '#007AFF', padding: 10, borderRadius: 8, width: '100%', alignItems: 'center' }
  });

  const styles = getStyles(colores);

  useFocusEffect(
      useCallback(() => {
        cargarContexto();
      }, [user])
  );

  const cargarContexto = async () => {
    if (!user) return;
    const { data: p } = await supabase.from('perfil').select('*').eq('user_id', user.id).limit(1);

    // Usar función SQL para obtener el plan activo (prioriza excepciones semanales)
    const hoy = new Date().toISOString().split('T')[0];
    const { data: planActivo } = await supabase.rpc('get_plan_activo', {
      p_user_id: user.id,
      p_fecha: hoy
    });

    // Fallback si la función RPC no está disponible aún
    let planData = planActivo?.[0];
    if (!planData) {
      const { data: pl } = await supabase.from('planes_semanales').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
      planData = pl?.[0];
    }

    // Cargar historial de entrenamientos (últimas 4 semanas)
    const hace4Semanas = new Date();
    hace4Semanas.setDate(hace4Semanas.getDate() - 28);
    const { data: hist } = await supabase
      .from('calendario_acciones')
      .select('fecha, estado')
      .eq('user_id', user.id)
      .eq('estado', 'completado')
      .gte('fecha', hace4Semanas.toISOString().split('T')[0])
      .order('fecha', { ascending: false });

    // Cargar catálogo de ejercicios para inyectar en prompt
    const { data: cat } = await supabase.from('catalogo_ejercicios').select('nombre').order('nombre');

    setPerfil(p?.[0] || {});
    setPlan(planData?.datos_semana || {});
    setHistorialReciente(hist || []);
    setCatalogoEjercicios(cat || []);
  };

  // Función para extraer JSON completo contando llaves (más robusto que regex)
  const extraerJSONCompleto = (texto: string): string | null => {
    const accionesValidas = ['ACTUALIZAR_PLAN', 'EXCEPCION_SEMANAL', 'BLOQUEAR_DIA'];
    const indicePosible = accionesValidas.reduce((idx, accion) => {
      const pos = texto.indexOf(`"accion"`) !== -1 ? texto.indexOf(`"${accion}"`) : -1;
      return pos !== -1 && (idx === -1 || pos < idx) ? pos : idx;
    }, -1);

    if (indicePosible === -1) return null;

    // Buscar el inicio del JSON (llave abierta) antes de la acción
    let inicioJson = texto.lastIndexOf('{', indicePosible);
    if (inicioJson === -1) return null;

    // Contar llaves para encontrar el final del JSON
    let contador = 0;
    let finJson = -1;
    for (let i = inicioJson; i < texto.length; i++) {
      if (texto[i] === '{') contador++;
      if (texto[i] === '}') contador--;
      if (contador === 0) {
        finJson = i;
        break;
      }
    }

    if (finJson === -1) return null;
    return texto.substring(inicioJson, finJson + 1);
  };

  const ejecutarHerramienta = async (comando) => {
    if (!user) return "❌ Usuario no autenticado.";
    console.log("🛠️ GROQ EJECUTANDO:", comando.accion);
    try {
      if (comando.accion === "ACTUALIZAR_PLAN") {
        const datosNormalizados = normalizarNombresEnPlan(comando.datos, catalogoEjercicios);
        const nuevoPlan = { ...plan, ...datosNormalizados };
        await supabase.from('planes_semanales').insert({
          user_id: user.id,
          nombre: "Plan Modificado por Groq",
          datos_semana: nuevoPlan
        });
        setPlan(nuevoPlan);
        return "✅ He actualizado tu plan semanal correctamente.";
      }

      if (comando.accion === "EXCEPCION_SEMANAL") {
        // Crear un plan temporal solo para esta semana
        const fechaInicio = comando.semana_inicio || new Date().toISOString().split('T')[0];
        const datosNormalizados = normalizarNombresEnPlan(comando.datos, catalogoEjercicios);
        await supabase.from('planes_semanales').insert({
          user_id: user.id,
          nombre: `Excepción Semanal (${fechaInicio})`,
          datos_semana: datosNormalizados,
          es_temporal: true,
          fecha_inicio: fechaInicio
        });
        return "✅ He ajustado esta semana. La próxima semana volverás a tu plan normal.";
      }

      if (comando.accion === "BLOQUEAR_DIA") {
        const { fecha, motivo } = comando.datos;
        await supabase.from('calendario_acciones').upsert({
          user_id: user.id,
          fecha: fecha,
          estado: 'descanso_extra',
          nota: motivo
        });
        return `✅ He marcado el ${fecha} como descanso (Excepción).`;
      }
      return "❌ Acción desconocida.";
    } catch (e) {
      return `❌ Error ejecutando acción: ${e.message}`;
    }
  };

  const enviarMensaje = async () => {
    if (!input.trim()) return;

    const textoUsuario = input;
    const nuevoMensaje = { id: Date.now(), texto: textoUsuario, esUsuario: true };
    setMensajes(prev => [...prev, nuevoMensaje]);
    setInput('');
    setCargando(true);

    try {
      const hoyISO = new Date().toISOString().split('T')[0];
      const diaSemana = new Date().toLocaleDateString('es-ES', { weekday: 'long' });

      const systemPrompt = `
Eres el "Arquitecto Fitness", un entrenador personal experto, motivacional e inspirador.
Tu misión es guiar al usuario hacia sus objetivos fitness con estrategias efectivas y basadas en ciencia.

HOY ES: ${diaSemana} (${hoyISO}).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CONTEXTO DEL USUARIO (Analiza antes de responder)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PERFIL:**
${JSON.stringify(perfil)}

**PLAN ACTUAL:**
${JSON.stringify(plan)}

**HISTORIAL RECIENTE (Últimas 4 semanas):**
${JSON.stringify(historialReciente)}

**LESIONES/LIMITACIONES:**
${perfil?.lesiones || 'Ninguna registrada'}

**NIVEL:** ${perfil?.nivel_actividad || 'No especificado'}

**CATÁLOGO DE EJERCICIOS (usa estos nombres EXACTOS cuando generes ejercicios):**
${catalogoEjercicios.length > 0 ? catalogoEjercicios.map(e => e.nombre).join(', ') : 'No disponible'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 SISTEMA DE RAZONAMIENTO (Sigue este flujo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PASO 1: ANÁLISIS DE INTENCIÓN**

Identifica qué busca el usuario:
A) ¿Rutina NUEVA desde cero? → Ir a MODO CREACIÓN
B) ¿MODIFICAR rutina actual (permanente)? → Ir a MODO MODIFICACIÓN
C) ¿Excepción SEMANAL? (ej: "esta semana quiero hacer X") → Ir a MODO EXCEPCIÓN SEMANAL
D) ¿Excepción PUNTUAL? (ej: "hoy no puedo") → Ir a MODO EXCEPCIÓN PUNTUAL
E) ¿Pregunta/consejo? → Responde directamente con tono inspirador

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PASO 2: MODO CREACIÓN (Rutina Nueva)**

**Datos necesarios:**
✓ Días disponibles por semana
✓ Tiempo por sesión (minutos)
✓ Material disponible (gimnasio/casa/equipamiento)
✓ Objetivo principal (fuerza/hipertrofia/resistencia/salud general)
✓ Experiencia previa

**Proceso:**
1. Si FALTA información → PREGUNTA (máx. 2 preguntas a la vez, tono motivador)
2. Si TIENES TODO → Propón resumen verbal explicando:
   - División propuesta (ej: "Torso/Pierna, 4 días")
   - RAZÓN de esa elección según sus datos
   - Beneficios esperados
3. Si usuario ACEPTA → Genera JSON 'ACTUALIZAR_PLAN'

**IMPORTANTE:**
- Si es principiante → Advierte sobre ejercicios técnicos (sentadillas, peso muerto)
- Si el volumen es alto → Menciona importancia del descanso
- Explica brevemente el enfoque de sobrecarga progresiva
- Incluye 1-2 tips de técnica clave por ejercicio

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PASO 3: MODO MODIFICACIÓN (Cambio Permanente)**

Ejemplos: "Cambia lunes a pecho", "Quita sentadillas"

**Proceso:**
1. Confirma el cambio explicando el impacto
2. Si el ejercicio está mal escrito → Pregunta: "Con [X], ¿te refieres a [Y]?"
3. Si falta equipamiento → Sugiere alternativas
4. Si cambia de idea → Pregunta: "¿Estás seguro? ¿Prefieres [alternativa]?"
5. Genera JSON 'ACTUALIZAR_PLAN' con cambios aplicados

**Consideraciones:**
- Si hay lesiones → Adapta ejercicios automáticamente
- Si reduce volumen mucho → Advierte sobre posible pérdida de progreso
- Explica por qué el cambio es bueno/malo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PASO 4: MODO EXCEPCIÓN SEMANAL (NUEVO)**

Ejemplos: "Esta semana voy solo 3 días", "Esta semana quiero hacer fullbody"

**CRÍTICO:** NO modifiques el plan permanente. Solo ajusta ESTA semana.

**Proceso:**
1. Confirma: "Entendido, solo para esta semana, ¿correcto?"
2. Explica cómo adaptarás la semana actual
3. Genera JSON 'EXCEPCION_SEMANAL' (no sobrescribe plan base)
4. Recuerda al usuario que la próxima semana vuelve a su plan normal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PASO 5: MODO EXCEPCIÓN PUNTUAL**

Ejemplos: "Hoy no puedo", "Mañana me duele la rodilla"

**Descanso forzado:**
- Genera JSON 'BLOQUEAR_DIA' con fecha y motivo
- Mensaje inspirador sobre la importancia del descanso

**Entreno diferente ese día:**
- NO generes JSON
- Responde: "Perfecto, hoy enfócate en [X]. Tu plan semanal sigue intacto."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ VALIDACIONES DE SEGURIDAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Si detectas 7 días consecutivos → "Recuerda que el músculo crece en el descanso. Considera al menos 1-2 días off."
✓ Si el volumen es excesivo para su nivel → "Este volumen puede ser contraproducente. ¿Qué tal si [alternativa]?"
✓ Si hay lesiones y pide ejercicio riesgoso → "Dado tu [lesión], te recomiendo [alternativa] para evitar agravar la zona."
✓ Si pide ejercicio inexistente → "¿Con '[ejercicio]' te refieres a '[ejercicio_real]'?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 FORMATOS JSON (Solo cuando corresponda)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ACTUALIZAR_PLAN] - Cambio permanente del plan:
@@JSON_START@@
{
  "accion": "ACTUALIZAR_PLAN",
  "datos": {
    "lunes": {
      "titulo": "Torso A",
      "ejercicios": [
        {
          "nombre": "Press Banca",
          "series": "4",
          "reps": "6-8",
          "tip": "Retrae escápulas, baja controlado"
        }
      ]
    }
  }
}
@@JSON_END@@

[EXCEPCION_SEMANAL] - Solo esta semana (NUEVO):
@@JSON_START@@
{
  "accion": "EXCEPCION_SEMANAL",
  "semana_inicio": "${hoyISO}",
  "datos": {
    "lunes": { "titulo": "...", "ejercicios": [...] }
  }
}
@@JSON_END@@

[BLOQUEAR_DIA] - Marcar descanso en fecha específica:
@@JSON_START@@
{
  "accion": "BLOQUEAR_DIA",
  "datos": {
    "fecha": "YYYY-MM-DD",
    "motivo": "..."
  }
}
@@JSON_END@@

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ PRINCIPIOS DE COMUNICACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Tono: Motivacional e inspirador, pero profesional (sin emojis excesivos)
✓ Asume conocimiento técnico, pero ofrece: "¿Necesitas que profundice en [concepto]?"
✓ Formato: Conversacional y natural
✓ Longitud: Conciso para confirmaciones, detallado para explicaciones
✓ Al final de cambios: Resume brevemente qué se modificó y por qué

**Ejemplo de resumen:**
"Listo. He actualizado tu lunes a Pecho/Hombro porque querías más frecuencia en press.
Esto te permitirá estimular esos grupos 2x por semana, ideal para hipertrofia.
La próxima semana notarás la diferencia."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 PROGRESIÓN Y EDUCACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Menciona sobrecarga progresiva cuando creas rutinas
- Si el historial muestra estancamiento → Sugiere estrategias (deload, cambio de rango de reps)
- Si detectas progreso consistente → Felicita y motiva a seguir
- Recomienda aumentos de peso: "Cuando completes las 8 reps en todas las series, sube 2.5-5kg"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**REGLAS DE ORO:**
1. Si estás entrevistando → NO generes JSON
2. Siempre explica el PORQUÉ de tus decisiones
3. Prioriza la seguridad y adaptación a lesiones
4. Inspira, pero mantén realismo basado en ciencia
5. Asegúrate que los ejercicios tengan la estructura correcta con "nombre"
6. SIEMPRE usa nombres del catálogo de ejercicios cuando existan. Si necesitas un ejercicio que no está en el catálogo, usa un nombre descriptivo claro en español.
      `;

      const historialChat = mensajes.slice(-20).map(m => ({
        role: m.esUsuario ? "user" : "assistant",
        content: m.texto
      }));

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            ...historialChat,
            { role: "user", content: textoUsuario }
          ],
          model: GROQ_MODEL,
          temperature: 0.5, 
          max_tokens: 2000
        })
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error.message);
      
      let respuestaIA = data.choices[0]?.message?.content || "";

      // Intentar detectar JSON con delimitadores primero
      const jsonRegexDelimitado = /@@JSON_START@@([\s\S]*?)@@JSON_END@@/;
      let match = respuestaIA.match(jsonRegexDelimitado);
      let jsonRaw = match ? match[1] : null;

      // Si no hay delimitadores, buscar JSON de acciones con función robusta
      if (!jsonRaw) {
        jsonRaw = extraerJSONCompleto(respuestaIA);
      }

      if (jsonRaw) {
        let resultadoAccion = "";
        try {
          const comando = JSON.parse(jsonRaw);
          resultadoAccion = await ejecutarHerramienta(comando);
          await cargarContexto();
        } catch (e) {
          resultadoAccion = "Error técnico: " + e.message;
        }
        // Eliminar TODOS los formatos de JSON de la respuesta visible
        respuestaIA = respuestaIA.replace(jsonRegexDelimitado, '').trim();
        respuestaIA = respuestaIA.replace(/```json[\s\S]*?```/g, '').trim();
        respuestaIA = respuestaIA.replace(/```[\s\S]*?```/g, '').trim();
        // Eliminar el JSON extraído directamente
        if (jsonRaw) {
          respuestaIA = respuestaIA.replace(jsonRaw, '').trim();
        }
        // Limpiar frases residuales comunes que quedan antes/después del JSON
        respuestaIA = respuestaIA.replace(/Aquí (está|tienes) el JSON[:\.]?/gi, '').trim();
        respuestaIA = respuestaIA.replace(/El JSON (es|sería)[:\.]?/gi, '').trim();
        // Limpiar múltiples saltos de línea
        respuestaIA = respuestaIA.replace(/\n{3,}/g, '\n\n').trim();
        respuestaIA += `\n\n_${resultadoAccion}_`;
      }

      setMensajes(prev => [...prev, { id: Date.now() + 1, texto: respuestaIA, esUsuario: false }]);

    } catch (e) {
      setMensajes(prev => [...prev, { id: Date.now() + 1, texto: "⚠️ Error de conexión: " + e.message, esUsuario: false }]);
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colores.fondo }]}>
      {/* HEADER CON BOTÓN INFO */}
      <View style={[styles.header, { backgroundColor: colores.tarjeta, borderColor: colores.borde }]}>
        <Text style={[styles.titulo, { color: colores.texto }]}>Groq Coach 🧠</Text>
        <TouchableOpacity onPress={() => setModalInfoVisible(true)}>
          <Ionicons name="information-circle-outline" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.chatArea} 
        contentContainerStyle={{paddingBottom: rutinaActiva ? 180 : 120}} // <--- PADDING DINÁMICO
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {mensajes.map((msg) => (
          <View key={msg.id} style={[styles.burbuja, msg.esUsuario ? styles.burbujaUsuario : [styles.burbujaIA, { backgroundColor: colores.tarjeta, borderColor: colores.borde }]]}>
            {msg.esUsuario ? (
              <Text style={styles.textoUsuario}>{msg.texto}</Text>
            ) : (
              <ReactMarkdown style={{
                body: { fontSize: 16, color: colores.texto },
                strong: { fontWeight: 'bold', color: colores.texto }
              }}>{msg.texto}</ReactMarkdown>
            )}
          </View>
        ))}
        {cargando && <ActivityIndicator color="#007AFF" style={{marginLeft: 20}} />}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        {/* INPUT AREA ELEVADA SI HAY RUTINA ACTIVA */}
        <View style={[
            styles.inputArea,
            { backgroundColor: colores.tarjeta, borderColor: colores.borde },
            rutinaActiva && { marginBottom: 65 } // <--- MARGEN DINÁMICO
        ]}>
          <TextInput
            style={[styles.input, { backgroundColor: colores.inputBg, color: colores.texto }]}
            placeholder="Escribe aquí..."
            placeholderTextColor={colores.subtexto}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity style={styles.btnEnviar} onPress={enviarMensaje} disabled={cargando}>
            <Ionicons name="send" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* MODAL DE INFORMACIÓN */}
      <Modal visible={modalInfoVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colores.tarjeta }]}>
            <Text style={[styles.modalTitle, { color: colores.texto }]}>Sobre tu Coach IA</Text>
            <Text style={[styles.modalText, { color: colores.texto }]}>
              Aquí puedes hablar con tu entrenador inteligente para:
              {"\n"}- Crear una rutina desde cero (Entrevista).
              {"\n"}- Modificar tu plan actual (Cambios permanentes).
              {"\n"}- Gestionar excepciones (Días que no puedes ir).
              {"\n"}- Resolver dudas sobre ejercicios o nutrición.
            </Text>
            <TouchableOpacity style={styles.btnCerrar} onPress={() => setModalInfoVisible(false)}>
              <Text style={{color:'white', fontWeight:'bold'}}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}