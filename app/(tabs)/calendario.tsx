import { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, useColorScheme } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../components/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- CONFIGURACIÓN GROQ ---
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";

LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene.','Feb.','Mar.','Abr.','May.','Jun.','Jul.','Ago.','Sep.','Oct.','Nov.','Dic.'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['Dom.','Lun.','Mar.','Mié.','Jue.','Vie.','Sáb.'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

export default function CalendarioScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const systemScheme = useColorScheme();
  const esOscuro = theme === 'dark' ? true : theme === 'light' ? false : systemScheme === 'dark';
  const colores = {
    fondo: esOscuro ? '#000000' : '#f8f9fa',
    tarjeta: esOscuro ? '#1c1c1e' : '#ffffff',
    texto: esOscuro ? '#ffffff' : '#333333',
    subtexto: esOscuro ? '#8e8e93' : '#666666',
    borde: esOscuro ? '#2c2c2e' : '#eee',
    primario: '#007AFF',
    danger: '#FF3B30',
    descansoBg: esOscuro ? '#2c2c2e' : '#f1f1f1',
    eliminarBg: esOscuro ? '#2c2c2e' : '#fff5f5',
    eliminarBorder: esOscuro ? '#2c2c2e' : '#ffebee',
    infoBg: esOscuro ? '#1c1c1e' : '#f0f9eb'
  };

  const styles = getStyles(colores);

  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [cargandoIA, setCargandoIA] = useState(false);
  const [modalInfoVisible, setModalInfoVisible] = useState(false);
  
  const datosRef = useRef({ perfil: null, plan: null, historial: [] });

  const [markedDates, setMarkedDates] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [infoDia, setInfoDia] = useState({ titulo: 'Selecciona un día', tipo: 'nada' });

  useFocusEffect(
    useCallback(() => {
      cargarDatosIniciales();
    }, [user])
  );

  const cargarDatosIniciales = async () => {
    if (!user) return;
    setCargando(true);
    try {
      const [resPerfil, resPlan, resHistorial] = await Promise.all([
        supabase.from('perfil').select('*').eq('user_id', user.id).limit(1),
        supabase.from('planes_semanales').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('calendario_acciones').select('*').eq('user_id', user.id)
      ]);

      datosRef.current.perfil = resPerfil.data?.[0] || {};
      datosRef.current.plan = resPlan.data?.[0]?.datos_semana || {};
      datosRef.current.historial = resHistorial.data || [];

      recalcularMarcas(selectedDate);

    } catch (e) { console.error("Error carga inicial:", e); } finally { setCargando(false); }
  };

  const recalcularMarcas = (fechaSeleccionada) => {
    const { perfil, plan, historial } = datosRef.current;
    const diasProhibidos = perfil.dias_no_disponibles ? perfil.dias_no_disponibles.toLowerCase().split(',') : [];
    
    const marcas = {};
    const diasSemanaNombres = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const hoy = new Date();

    for (let i = -40; i < 60; i++) {
      const d = new Date();
      d.setDate(hoy.getDate() + i);
      const fechaStr = d.toISOString().split('T')[0];
      const nombreDia = diasSemanaNombres[d.getDay()];

      let bloqueado = false;

      // 1. Días Prohibidos
      if (diasProhibidos.includes(nombreDia)) {
        bloqueado = true;
        marcas[fechaStr] = { disabled: true, disableTouchEvent: false, color: '#f2f2f7', textColor: '#ccc' }; 
      }

      // 2. Planificación (Puntos Azules)
      if (!bloqueado && plan[nombreDia] && plan[nombreDia].titulo !== 'Descanso') {
         marcas[fechaStr] = { marked: true, dotColor: '#007AFF' };
      }

      // 3. Historial Real (Sobreescribe con Verdes/Grises)
      const accion = historial.find(h => h.fecha === fechaStr);
      if (accion) {
        if (accion.estado === 'completado') {
           marcas[fechaStr] = { selected: true, selectedColor: '#34C759', marked: true, dotColor: 'white' };
        } else if (accion.estado === 'descanso_extra') {
           marcas[fechaStr] = { selected: true, selectedColor: '#8e8e93', disableTouchEvent: false };
        }
      }
    }
    
    const estiloPrevio = marcas[fechaSeleccionada] || {};
    const colorFinal = (estiloPrevio.selectedColor && estiloPrevio.selectedColor !== '#007AFF') 
                        ? estiloPrevio.selectedColor 
                        : '#007AFF';

    marcas[fechaSeleccionada] = { 
      ...estiloPrevio, 
      selected: true, 
      selectedColor: colorFinal
    };

    setMarkedDates(marcas);
    analizarDia(fechaSeleccionada);
  };

  const analizarDia = (fecha) => {
    const { perfil, plan, historial } = datosRef.current;
    const diasProhibidos = perfil.dias_no_disponibles ? perfil.dias_no_disponibles.toLowerCase().split(',') : [];
    
    const d = new Date(fecha);
    const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const nombreDia = dias[d.getDay()];

    const accion = historial.find(h => h.fecha === fecha);
    
    if (accion?.estado === 'completado') {
      setInfoDia({ titulo: '✅ Entrenamiento Completado', tipo: 'completado' });
      return;
    }
    if (accion?.estado === 'descanso_extra') {
      setInfoDia({ titulo: '💤 Descanso (Manual)', tipo: 'descanso_manual' });
      return;
    }
    if (diasProhibidos.includes(nombreDia)) {
      setInfoDia({ titulo: '🚫 Día No Disponible', tipo: 'bloqueado' });
      return;
    }

    const rutina = plan && plan[nombreDia];
    if (rutina && rutina.titulo !== 'Descanso') {
      setInfoDia({ titulo: `💪 Toca: ${rutina.titulo}`, tipo: 'entreno' });
    } else {
      setInfoDia({ titulo: '💤 Descanso Planificado', tipo: 'descanso' });
    }
  };

  const onDayPress = (day) => {
    setSelectedDate(day.dateString);
    recalcularMarcas(day.dateString); 
  };

  const eliminarDescanso = async () => {
    Alert.alert("Quitar Descanso", "¿Liberar este día?", [
        { text: "Cancelar" },
        { text: "Eliminar", style: 'destructive', onPress: async () => {
            if (user) {
              await supabase.from('calendario_acciones').delete().eq('fecha', selectedDate).eq('user_id', user.id);
              cargarDatosIniciales();
            }
        }}
    ]);
  };

  const eliminarCompletado = async () => {
    Alert.alert("Borrar Entrenamiento", "Se eliminará el registro y los datos de series de este día.", [
        { text: "Cancelar" },
        { text: "Eliminar", style: 'destructive', onPress: async () => {
            if (user) {
              await supabase.from('calendario_acciones').delete().match({ fecha: selectedDate, estado: 'completado', user_id: user.id });
              await supabase.from('historial_series').delete().eq('fecha', selectedDate).eq('user_id', user.id);
              cargarDatosIniciales();
            }
        }}
    ]);
  };

  const anadirDescansoYRecalcular = async () => {
    Alert.alert("Descansar hoy", "La IA moverá tu entreno.", [
      { text: "Cancelar" },
      { text: "Confirmar", onPress: ejecutarRecalculoGroq }
    ]);
  };

  const ejecutarRecalculoGroq = async () => {
    if (!user) return;
    setCargandoIA(true);
    try {
      await supabase.from('calendario_acciones').upsert({ user_id: user.id, fecha: selectedDate, estado: 'descanso_extra' });

      const prompt = `
        ACTÚA COMO ENTRENADOR.
        PLAN ACTUAL: ${JSON.stringify(datosRef.current.plan)}
        RESTRICCIONES: ${datosRef.current.perfil?.dias_no_disponibles}
        SITUACIÓN: El usuario descansa obligatoriamente el ${selectedDate}.
        TAREA: Ajusta la semana moviendo el entreno perdido al siguiente hueco libre.
        SALIDA: ÚNICAMENTE JSON VÁLIDO con formato { "nombre": "Ajuste", "dias": {...} }
      `;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          model: GROQ_MODEL
        })
      });

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "";

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const nuevoPlan = JSON.parse(jsonMatch[0]);
        await supabase.from('planes_semanales').insert({ user_id: user.id, nombre: "Ajuste Groq", datos_semana: nuevoPlan.dias || nuevoPlan.datos_semana });
        cargarDatosIniciales();
        Alert.alert("Plan Ajustado", "Groq ha reorganizado tu semana.");
      }
    } catch (e) { Alert.alert("Error Groq", e.message); } finally { setCargandoIA(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Calendario 📅</Text>
        <TouchableOpacity onPress={() => setModalInfoVisible(true)}>
          <Ionicons name="information-circle-outline" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Calendar
          current={selectedDate}
          onDayPress={onDayPress}
          markedDates={markedDates}
          firstDay={1} 
          theme={{
            backgroundColor: colores.fondo,
            calendarBackground: colores.tarjeta,
            textSectionTitleColor: colores.texto,
            selectedDayBackgroundColor: colores.primario,
            todayTextColor: colores.primario,
            arrowColor: colores.primario,
            monthTextColor: colores.texto,
            textDayFontFamily: 'System',
            textMonthFontFamily: 'System',
            textDayHeaderFontFamily: 'System',
            textDayFontWeight: '300',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '300',
            textDayFontSize: 16,
            textMonthFontSize: 18,
            textDayHeaderFontSize: 14,
            dayTextColor: colores.texto,
            textDisabledColor: colores.subtexto,
            dotColor: colores.primario
          }}
        />
        
        <View style={styles.detalleCard}>
          <Text style={styles.fechaTitulo}>{new Date(selectedDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          <Text style={styles.estadoTitulo}>{infoDia.titulo}</Text>

          <View style={styles.acciones}>
            
            {(infoDia.tipo === 'entreno' || infoDia.tipo === 'descanso' || infoDia.tipo === 'bloqueado') && (
               <TouchableOpacity style={[styles.btnEmpezar, infoDia.tipo !== 'entreno' && {backgroundColor: '#666'}]} onPress={() => router.push('/rutinas')}>
                <Ionicons name={infoDia.tipo === 'entreno' ? "play-circle" : "barbell"} size={24} color="white" />
                <Text style={styles.txtBtn}>{infoDia.tipo === 'entreno' ? "EMPEZAR RUTINA" : "ENTRENO EXTRA"}</Text>
              </TouchableOpacity>
            )}

            {infoDia.tipo === 'completado' && (
              <View style={{gap:10}}>
                  <View style={styles.infoBox}>
                      <Text style={{color:'#333'}}>¡Gran trabajo! Has cumplido el objetivo.</Text>
                  </View>
                  <TouchableOpacity style={styles.btnEliminar} onPress={eliminarCompletado}>
                     <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                     <Text style={styles.txtEliminar}>Eliminar Registro</Text>
                  </TouchableOpacity>
              </View>
            )}

            {infoDia.tipo === 'entreno' && (
              <TouchableOpacity style={styles.btnDescanso} onPress={anadirDescansoYRecalcular}>
                {cargandoIA ? <ActivityIndicator color="#333"/> : <Text style={styles.txtDescanso}>No puedo entrenar hoy</Text>}
              </TouchableOpacity>
            )}

            {infoDia.tipo === 'descanso_manual' && (
              <TouchableOpacity style={styles.btnEliminar} onPress={eliminarDescanso}>
                 <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                 <Text style={styles.txtEliminar}>Quitar Descanso</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* MODAL INFO */}
      <Modal visible={modalInfoVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentSmall}>
            <Text style={styles.modalTitle}>Leyenda del Calendario</Text>
            <Text style={{marginBottom:20, lineHeight:22, color:'#666'}}>
              • 🟢 Verde: Entreno completado.
              {"\n"}• 🔵 Punto Azul: Día con rutina programada.
              {"\n"}• ⚪ Gris: Descanso manual o día bloqueado.
              {"\n"}• Pulsa un día para ver opciones.
            </Text>
            <TouchableOpacity style={styles.btnDescanso} onPress={() => setModalInfoVisible(false)}>
              <Text style={{fontWeight:'bold'}}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (colores) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  header: { padding: 20, backgroundColor: colores.tarjeta, alignItems: 'center', borderBottomWidth:1, borderColor: colores.borde, flexDirection:'row', justifyContent:'space-between' },
  titulo: { fontSize: 20, fontWeight: 'bold', color: colores.texto },
  detalleCard: { margin: 20, padding: 20, backgroundColor: colores.tarjeta, borderRadius: 20, shadowColor:'#000', shadowOpacity:0.05, elevation:3 },
  fechaTitulo: { fontSize: 14, color: colores.subtexto, textTransform: 'capitalize', marginBottom: 5 },
  estadoTitulo: { fontSize: 20, fontWeight: 'bold', color: colores.texto, marginBottom: 20 },
  acciones: { gap: 15 },
  btnEmpezar: { backgroundColor: colores.primario, padding: 18, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  txtBtn: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  btnDescanso: { backgroundColor: colores.descansoBg, padding: 15, borderRadius: 15, alignItems: 'center' },
  txtDescanso: { color: colores.subtexto, fontWeight: 'bold' },
  btnEliminar: { backgroundColor: colores.eliminarBg, padding: 15, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colores.eliminarBorder },
  txtEliminar: { color: colores.danger, fontWeight: 'bold' },
  infoBox: { backgroundColor: colores.infoBg, padding:15, borderRadius:10, marginBottom:5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContentSmall: { backgroundColor: colores.tarjeta, width: '80%', padding: 20, borderRadius: 15 },
  modalTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 15, textAlign: 'center', color: colores.texto },
});