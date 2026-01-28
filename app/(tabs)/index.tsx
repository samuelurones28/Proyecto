import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, useColorScheme } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import ReactMarkdown from 'react-native-markdown-display';
import { useTheme } from '../../components/ThemeContext';
import { useWorkout } from '../../components/WorkoutContext'; // <--- NUEVO IMPORT
import { SafeAreaView } from 'react-native-safe-area-context';

// --- CONFIGURACIÓN GROQ ---
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";

export default function ChatScreen() {
  const { theme } = useTheme();
  const { rutinaActiva } = useWorkout(); // <--- OBTENER ESTADO DE RUTINA
  const systemScheme = useColorScheme();
  const [mensajes, setMensajes] = useState([
    { id: 1, texto: "⚡ Hola. Soy tu Arquitecto Fitness. ¿Creamos una rutina nueva o ajustamos la actual?", esUsuario: false }
  ]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalInfoVisible, setModalInfoVisible] = useState(false);
  const scrollViewRef = useRef(null);

  // Contexto en tiempo real
  const [perfil, setPerfil] = useState(null);
  const [plan, setPlan] = useState(null);

  // --- TEMA ---
  const esOscuro = theme === 'dark' ? true : theme === 'light' ? false : systemScheme === 'dark';
  const colores = {
    bg: esOscuro ? '#000000' : '#f2f2f7',
    card: esOscuro ? '#1c1c1e' : 'white',
    text: esOscuro ? '#ffffff' : '#333333',
    border: esOscuro ? '#333333' : '#ddd',
    input: esOscuro ? '#2c2c2e' : '#f2f2f7',
    placeholder: esOscuro ? '#888888' : '#666666'
  };

  const getStyles = (colores) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colores.bg },
    header: { padding: 15, backgroundColor: colores.card, borderBottomWidth: 1, borderColor: colores.border, flexDirection:'row', justifyContent:'space-between', alignItems: 'center' },
    titulo: { fontSize: 18, fontWeight: 'bold', color: colores.text },
    chatArea: { flex: 1, padding: 15 },
    burbuja: { maxWidth: '85%', padding: 12, borderRadius: 18, marginBottom: 10 },
    burbujaUsuario: { backgroundColor: '#007AFF', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
    burbujaIA: { backgroundColor: colores.card, alignSelf: 'flex-start', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: colores.border },
    textoUsuario: { color: 'white', fontSize: 16 },
    inputArea: { flexDirection: 'row', padding: 10, backgroundColor: colores.card, alignItems: 'center', gap: 10, borderTopWidth:1, borderColor: colores.border },
    input: { flex: 1, backgroundColor: colores.input, padding: 10, borderRadius: 20, fontSize: 16, maxHeight: 100, color: colores.text },
    btnEnviar: { backgroundColor: '#007AFF', width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: colores.card, width: '80%', padding: 20, borderRadius: 15, alignItems:'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: colores.text },
    modalText: { fontSize: 14, color: colores.placeholder, lineHeight: 22, textAlign: 'left', marginBottom: 20 },
    btnCerrar: { backgroundColor: '#007AFF', padding: 10, borderRadius: 8, width: '100%', alignItems: 'center' }
  });

  const styles = getStyles(colores);

  useFocusEffect(
      useCallback(() => {
        cargarContexto();
      }, [])
  );

  const cargarContexto = async () => {
    const { data: p } = await supabase.from('perfil').select('*').limit(1);
    const { data: pl } = await supabase.from('planes_semanales').select('*').order('created_at', { ascending: false }).limit(1);
    setPerfil(p?.[0] || {});
    setPlan(pl?.[0]?.datos_semana || {});
  };

  const ejecutarHerramienta = async (comando) => {
    console.log("🛠️ GROQ EJECUTANDO:", comando.accion);
    try {
      if (comando.accion === "ACTUALIZAR_PLAN") {
        const nuevoPlan = { ...plan, ...comando.datos }; 
        await supabase.from('planes_semanales').insert({
          nombre: "Plan Modificado por Groq",
          datos_semana: nuevoPlan
        });
        setPlan(nuevoPlan);
        return "✅ He actualizado tu plan semanal correctamente.";
      }

      if (comando.accion === "BLOQUEAR_DIA") {
        const { fecha, motivo } = comando.datos;
        await supabase.from('calendario_acciones').upsert({
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
        Eres el "Arquitecto Fitness", un entrenador experto, lógico y empático.
        HOY ES: ${diaSemana} (${hoyISO}).
        
        TUS HERRAMIENTAS (DATOS):
        - PERFIL USUARIO: ${JSON.stringify(perfil)}
        - PLAN ACTUAL: ${JSON.stringify(plan)}

        --- FLUJO DE PENSAMIENTO (Sigue estos pasos en orden) ---

        1. **ANÁLISIS DE INTENCIÓN:**
           - ¿El usuario quiere una rutina NUEVA desde cero? -> Ve al Paso 2.
           - ¿El usuario quiere MODIFICAR la rutina actual? -> Ve al Paso 3.
           - ¿El usuario habla de hoy/mañana (excepciones)? -> Ve al Paso 4.

        2. **MODO CREACIÓN (Entrevista):**
           - Si pide rutina nueva, verifica si tienes estos datos:
             A) Días por semana disponibles.
             B) Tiempo por sesión.
             C) Material disponible (Gym/Casa).
             D) Objetivo (Fuerza/Estética/Salud).
           - **SI FALTA ALGO:** PREGUNTA (Máximo 2 preguntas a la vez). NO generes JSON todavía.
           - **SI TIENES TODO:** Propón un resumen verbal ("Te propongo una Torso/Pierna de 4 días...").
           - **SI EL USUARIO ACEPTA:** Genera el JSON 'ACTUALIZAR_PLAN'.

        3. **MODO MODIFICACIÓN (Cambios Permanentes):**
           - Ej: "Cambia el lunes a pecho", "Quita las sentadillas".
           - Genera JSON 'ACTUALIZAR_PLAN' con los cambios aplicados.

        4. **MODO EXCEPCIÓN (Cambios Temporales):**
           - **Descanso:** Ej: "Hoy no voy", "Me duele la rodilla".
             -> Genera JSON 'BLOQUEAR_DIA'.
           - **Entreno extra/raro:** Ej: "Hoy quiero hacer brazo aunque toque pierna".
             -> NO TOQUES EL PLAN (JSON). Responde: "Oído, hoy dale a brazo. No modifico tu plan semanal para no desorganizarte."

        --------------------------------------------------
        FORMATO JSON OBLIGATORIO PARA ACCIONES (Solo al final):
        
        [ACTUALIZAR_PLAN] - Para rutinas nuevas o cambios permanentes:
        @@JSON_START@@
        {
          "accion": "ACTUALIZAR_PLAN",
          "datos": { 
             "lunes": { 
                "titulo": "Torso A", 
                "ejercicios": [ 
                   { "nombre": "Press Banca", "series": "4", "reps": "6-8", "tip": "Retrae escápulas" }
                ] 
             }
          }
        }
        @@JSON_END@@
        
        [BLOQUEAR_DIA] - Solo para marcar descansos en fechas concretas:
        @@JSON_START@@
        { "accion": "BLOQUEAR_DIA", "datos": { "fecha": "YYYY-MM-DD", "motivo": "..." } }
        @@JSON_END@@

        REGLAS DE ORO:
        - Si estás entrevistando, **NO** pongas JSON.
        - Si generas una rutina, asegúrate de que la estructura de 'ejercicios' sea una lista de objetos con "nombre".
      `;

      const historialChat = mensajes.slice(-8).map(m => ({
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

      const jsonRegex = /@@JSON_START@@([\s\S]*?)@@JSON_END@@/;
      const match = respuestaIA.match(jsonRegex);

      if (match) {
        const jsonRaw = match[1];
        let resultadoAccion = "";
        try {
          const comando = JSON.parse(jsonRaw);
          resultadoAccion = await ejecutarHerramienta(comando);
          await cargarContexto(); 
        } catch (e) {
          resultadoAccion = "Error técnico: " + e.message;
        }
        respuestaIA = respuestaIA.replace(jsonRegex, '').trim();
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
    <SafeAreaView style={[styles.container, { backgroundColor: colores.bg }]}>
      {/* HEADER CON BOTÓN INFO */}
      <View style={[styles.header, { backgroundColor: colores.card, borderColor: colores.border }]}>
        <Text style={[styles.titulo, { color: colores.text }]}>Groq Coach 🧠</Text>
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
          <View key={msg.id} style={[styles.burbuja, msg.esUsuario ? styles.burbujaUsuario : [styles.burbujaIA, { backgroundColor: colores.card, borderColor: colores.border }]]}>
            {msg.esUsuario ? (
              <Text style={styles.textoUsuario}>{msg.texto}</Text>
            ) : (
              <ReactMarkdown style={{
                body: { fontSize: 16, color: colores.text },
                strong: { fontWeight: 'bold', color: colores.text }
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
            { backgroundColor: colores.card, borderColor: colores.border },
            rutinaActiva && { marginBottom: 65 } // <--- MARGEN DINÁMICO
        ]}>
          <TextInput 
            style={[styles.input, { backgroundColor: colores.input, color: colores.text }]} 
            placeholder="Escribe aquí..." 
            placeholderTextColor={colores.placeholder}
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
          <View style={[styles.modalContent, { backgroundColor: colores.card }]}>
            <Text style={[styles.modalTitle, { color: colores.text }]}>Sobre tu Coach IA</Text>
            <Text style={[styles.modalText, { color: colores.text }]}>
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