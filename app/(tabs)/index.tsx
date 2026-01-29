import React, { useState, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, useColorScheme } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import ReactMarkdown from 'react-native-markdown-display';
import { useTheme } from '../../components/ThemeContext';
import { useWorkout } from '../../components/WorkoutContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";

export default function ChatScreen() {
  const { theme } = useTheme();
  const { rutinaActiva } = useWorkout();
  const systemScheme = useColorScheme();
  const scrollViewRef = useRef(null);
  const [mensajes, setMensajes] = useState([{ id: 1, texto: "⚡ Hola. Soy tu Arquitecto Fitness. ¿Creamos una rutina nueva o ajustamos la actual?", esUsuario: false }]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalInfoVisible, setModalInfoVisible] = useState(false);
  const [perfil, setPerfil] = useState(null);
  const [plan, setPlan] = useState(null);

  const esOscuro = theme === 'dark' ? true : theme === 'light' ? false : systemScheme === 'dark';
  const colores = { bg: esOscuro ? '#000000' : '#f2f2f7', card: esOscuro ? '#1c1c1e' : 'white', text: esOscuro ? '#ffffff' : '#333333', border: esOscuro ? '#333333' : '#ddd', input: esOscuro ? '#2c2c2e' : '#f2f2f7', placeholder: esOscuro ? '#888888' : '#666666' };

  useFocusEffect(useCallback(() => { cargarContexto(); }, []));

  const cargarContexto = async () => {
    const [{ data: p }, { data: pl }] = await Promise.all([supabase.from('perfil').select('*').limit(1), supabase.from('planes_semanales').select('*').order('created_at', { ascending: false }).limit(1)]);
    setPerfil(p?.[0] || {}); setPlan(pl?.[0]?.datos_semana || {});
  };

  const ejecutarHerramienta = async (comando) => {
    try {
      if (comando.accion === "ACTUALIZAR_PLAN") {
        const nuevoPlan = { ...plan, ...comando.datos };
        await supabase.from('planes_semanales').insert({ nombre: "Plan Modificado por Groq", datos_semana: nuevoPlan });
        setPlan(nuevoPlan);
        return "✅ He actualizado tu plan semanal correctamente.";
      }
      if (comando.accion === "BLOQUEAR_DIA") {
        await supabase.from('calendario_acciones').upsert({ fecha: comando.datos.fecha, estado: 'descanso_extra', nota: comando.datos.motivo });
        return `✅ He marcado el ${comando.datos.fecha} como descanso (Excepción).`;
      }
      return "❌ Acción desconocida.";
    } catch (e) { return `❌ Error ejecutando acción: ${e.message}`; }
  };

  const enviarMensaje = async () => {
    if (!input.trim()) return;
    const textoUsuario = input;
    setMensajes(prev => [...prev, { id: Date.now(), texto: textoUsuario, esUsuario: true }]);
    setInput(''); setCargando(true);

    try {
      const hoyISO = new Date().toISOString().split('T')[0];
      const diaSemana = new Date().toLocaleDateString('es-ES', { weekday: 'long' });
      const systemPrompt = `Eres el "Arquitecto Fitness", entrenador experto. HOY: ${diaSemana} (${hoyISO}). PERFIL: ${JSON.stringify(perfil)} PLAN: ${JSON.stringify(plan)}

FLUJO: 1) INTENCIÓN: ¿Rutina nueva? ->Paso2. ¿Modificar actual? ->Paso3. ¿Hoy/mañana? ->Paso4.
2) CREACIÓN: Verifica: A)Días disponibles B)Tiempo/sesión C)Material D)Objetivo. SI FALTA: pregunta (máx 2). SI TODO: resume verbal. SI ACEPTA: JSON ACTUALIZAR_PLAN.
3) MODIFICACIÓN: Genera JSON ACTUALIZAR_PLAN con cambios.
4) EXCEPCIÓN: Descanso->JSON BLOQUEAR_DIA. Entreno extra->NO JSON, responde verbal.

JSON FORMATO:
[ACTUALIZAR_PLAN]: @@JSON_START@@{"accion":"ACTUALIZAR_PLAN","datos":{"lunes":{"titulo":"Torso A","ejercicios":[{"nombre":"Press Banca","series":"4","reps":"6-8","tip":"Retrae escápulas"}]}}}@@JSON_END@@
[BLOQUEAR_DIA]: @@JSON_START@@{"accion":"BLOQUEAR_DIA","datos":{"fecha":"YYYY-MM-DD","motivo":"..."}}@@JSON_END@@

REGLAS: Si entrevistas NO JSON. Ejercicios = lista de objetos con "nombre".`;

      const historialChat = mensajes.slice(-8).map(m => ({ role: m.esUsuario ? "user" : "assistant", content: m.texto }));
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "system", content: systemPrompt }, ...historialChat, { role: "user", content: textoUsuario }], model: GROQ_MODEL, temperature: 0.5, max_tokens: 2000 })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      let respuestaIA = data.choices[0]?.message?.content || "";
      const jsonRegex = /@@JSON_START@@([\s\S]*?)@@JSON_END@@/;
      const match = respuestaIA.match(jsonRegex);
      if (match) {
        let resultadoAccion = "";
        try { resultadoAccion = await ejecutarHerramienta(JSON.parse(match[1])); await cargarContexto(); }
        catch (e) { resultadoAccion = "Error técnico: " + e.message; }
        respuestaIA = respuestaIA.replace(jsonRegex, '').trim() + `\n\n_${resultadoAccion}_`;
      }
      setMensajes(prev => [...prev, { id: Date.now() + 1, texto: respuestaIA, esUsuario: false }]);
    } catch (e) { setMensajes(prev => [...prev, { id: Date.now() + 1, texto: "⚠️ Error de conexión: " + e.message, esUsuario: false }]); }
    finally { setCargando(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colores.bg }]}>
      <View style={[styles.header, { backgroundColor: colores.card, borderColor: colores.border }]}>
        <Text style={[styles.titulo, { color: colores.text }]}>Groq Coach 🧠</Text>
        <TouchableOpacity onPress={() => setModalInfoVisible(true)}>
          <Ionicons name="information-circle-outline" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.chatArea} contentContainerStyle={{ paddingBottom: rutinaActiva ? 180 : 120 }} ref={scrollViewRef} onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
        {mensajes.map((msg) => (
          <View key={msg.id} style={[styles.burbuja, msg.esUsuario ? styles.burbujaUsuario : [styles.burbujaIA, { backgroundColor: colores.card, borderColor: colores.border }]]}>
            {msg.esUsuario ? <Text style={styles.textoUsuario}>{msg.texto}</Text> : <ReactMarkdown style={{ body: { fontSize: 16, color: colores.text }, strong: { fontWeight: 'bold', color: colores.text } }}>{msg.texto}</ReactMarkdown>}
          </View>
        ))}
        {cargando && <ActivityIndicator color="#007AFF" style={{ marginLeft: 20 }} />}
      </ScrollView>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <View style={[styles.inputArea, { backgroundColor: colores.card, borderColor: colores.border }, rutinaActiva && { marginBottom: 65 }]}>
          <TextInput style={[styles.input, { backgroundColor: colores.input, color: colores.text }]} placeholder="Escribe aquí..." placeholderTextColor={colores.placeholder} value={input} onChangeText={setInput} multiline />
          <TouchableOpacity style={styles.btnEnviar} onPress={enviarMensaje} disabled={cargando}><Ionicons name="send" size={24} color="white" /></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={modalInfoVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colores.card }]}>
            <Text style={[styles.modalTitle, { color: colores.text }]}>Sobre tu Coach IA</Text>
            <Text style={[styles.modalText, { color: colores.text }]}>Aquí puedes hablar con tu entrenador inteligente para:{"\n"}- Crear una rutina desde cero (Entrevista).{"\n"}- Modificar tu plan actual (Cambios permanentes).{"\n"}- Gestionar excepciones (Días que no puedes ir).{"\n"}- Resolver dudas sobre ejercicios o nutrición.</Text>
            <TouchableOpacity style={styles.btnCerrar} onPress={() => setModalInfoVisible(false)}><Text style={{ color: 'white', fontWeight: 'bold' }}>Entendido</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 15, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 18, fontWeight: 'bold' },
  chatArea: { flex: 1, padding: 15 },
  burbuja: { maxWidth: '85%', padding: 12, borderRadius: 18, marginBottom: 10 },
  burbujaUsuario: { backgroundColor: '#007AFF', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  burbujaIA: { alignSelf: 'flex-start', borderBottomLeftRadius: 2, borderWidth: 1 },
  textoUsuario: { color: 'white', fontSize: 16 },
  inputArea: { flexDirection: 'row', padding: 10, alignItems: 'center', gap: 10, borderTopWidth: 1 },
  input: { flex: 1, padding: 10, borderRadius: 20, fontSize: 16, maxHeight: 100 },
  btnEnviar: { backgroundColor: '#007AFF', width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', padding: 20, borderRadius: 15, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  modalText: { fontSize: 14, lineHeight: 22, textAlign: 'left', marginBottom: 20 },
  btnCerrar: { backgroundColor: '#007AFF', padding: 10, borderRadius: 8, width: '100%', alignItems: 'center' }
});