import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../supabase';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useAuth } from '../../components/AuthContext';
import { useWorkout } from '../../components/WorkoutContext';
import { useAppColors, AppColors } from '../../hooks/useAppColors';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ColoresExtendidos extends AppColors {
  filterBg: string;
  btnCancelBg: string;
}

interface Medicion {
  id: number;
  fecha: string;
  peso: number;
  grasa_porc?: number;
  grasa_kg?: number;
  musculo_kg?: number;
  musculo_porc?: number;
}

export default function ProgresoScreen() {
  const { user } = useAuth();
  const { rutinaActiva } = useWorkout();
  const { esOscuro, colores: baseColores } = useAppColors();

  // Extender colores base con colores específicos de esta pantalla
  const colores: ColoresExtendidos = {
    ...baseColores,
    filterBg: esOscuro ? '#1c1c1e' : '#f8f9fa',
    btnCancelBg: esOscuro ? '#2c2c2e' : '#eee'
  };

  const styles = getStyles(colores);

  const [mediciones, setMediciones] = useState<Medicion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalInfoVisible, setModalInfoVisible] = useState(false);
  const [modoGrafica, setModoGrafica] = useState('peso'); 
  const [rangoTemporal, setRangoTemporal] = useState('1M'); 
  
  const [modalVisible, setModalVisible] = useState(false);
  const [nuevoPeso, setNuevoPeso] = useState('');
  const [nuevaGrasa, setNuevaGrasa] = useState('');
  const [nuevoMusculo, setNuevoMusculo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [user])
  );

  const cargarDatos = async () => {
    if (!user) return;
    setCargando(true);
    try {
      const { data, error } = await supabase.from('mediciones').select('*').eq('user_id', user.id).order('fecha', { ascending: false });
      if (error) throw error;
      setMediciones(data || []);
    } catch (error) { console.error('Error:', (error as Error).message); } finally { setCargando(false); }
  };

  const guardarNuevaMedicion = async () => {
    if (!nuevoPeso || !user) { Alert.alert("Falta el peso", "Introduce al menos el peso."); return; }
    setGuardando(true);
    try {
      const pesoNum = parseFloat(nuevoPeso.replace(',', '.'));
      const grasaPorc = nuevaGrasa ? parseFloat(nuevaGrasa.replace(',', '.')) : null;
      const musculoKg = nuevoMusculo ? parseFloat(nuevoMusculo.replace(',', '.')) : null;
      let grasaKg = null, musculoPorc = null;
      if (grasaPorc) grasaKg = (pesoNum * (grasaPorc / 100)).toFixed(2);
      if (musculoKg) musculoPorc = ((musculoKg / pesoNum) * 100).toFixed(2);

      const { error } = await supabase.from('mediciones').insert({ user_id: user.id, fecha: new Date().toISOString(), peso: pesoNum, grasa_porc: grasaPorc, grasa_kg: grasaKg, musculo_kg: musculoKg, musculo_porc: musculoPorc });
      if (error) throw error;
      setModalVisible(false); setNuevoPeso(''); setNuevaGrasa(''); setNuevoMusculo(''); cargarDatos(); Alert.alert("¡Guardado!", "Progreso registrado.");
    } catch (e) { Alert.alert("Error", (e as Error).message); } finally { setGuardando(false); }
  };

  const eliminarMedicion = (id: number) => {
    Alert.alert("Eliminar", "¿Borrar este registro?", [{ text: "Cancelar", style: "cancel" }, { text: "Eliminar", style: "destructive", onPress: async () => { await supabase.from('mediciones').delete().eq('id', id); cargarDatos(); }}]);
  };

  const prepararDatosGrafica = () => {
    if (!mediciones || mediciones.length < 2) return null;
    const hoy = new Date();
    let datosFiltrados: Medicion[] = [];
    if (rangoTemporal === '1M') {
        const hace30dias = new Date(); hace30dias.setDate(hoy.getDate() - 30);
        datosFiltrados = mediciones.filter(m => new Date(m.fecha) >= hace30dias);
    } else {
        const hace1anio = new Date(); hace1anio.setFullYear(hoy.getFullYear() - 1);
        datosFiltrados = mediciones.filter(m => new Date(m.fecha) >= hace1anio);
    }
    if (datosFiltrados.length < 2 && rangoTemporal === '1M') datosFiltrados = [...mediciones].slice(0, 5); 
    else if (datosFiltrados.length === 0) return null;

    datosFiltrados.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    if (rangoTemporal === '1Y' && datosFiltrados.length > 20) {
        const porMes: Record<string, Medicion> = {}; datosFiltrados.forEach(d => { const key = d.fecha.substring(0, 7); porMes[key] = d; });
        datosFiltrados = Object.values(porMes);
    }

    let dataPoints: number[] = [], suffix = '';
    if (modoGrafica === 'peso') { dataPoints = datosFiltrados.map(m => m.peso); suffix = 'kg'; }
    else if (modoGrafica === 'grasa') { dataPoints = datosFiltrados.map(m => m.grasa_porc || 0); suffix = '%'; }
    else if (modoGrafica === 'musculo') { dataPoints = datosFiltrados.map(m => m.musculo_kg || 0); suffix = 'kg'; }

    const labels = datosFiltrados.map((m, index) => {
        const d = new Date(m.fecha);
        const label = rangoTemporal === '1Y' ? d.toLocaleDateString('es-ES', { month: 'short' }) : d.getDate().toString(); 
        if (datosFiltrados.length > 6 && index % 2 !== 0) return ""; 
        return label;
    });
    return { labels, datasets: [{ data: dataPoints }], suffix };
  };

  const datosGrafica = prepararDatosGrafica();
  const FilterBtn = ({ label, mode }: { label: string; mode: string }) => (<TouchableOpacity style={[styles.filterBtn, modoGrafica === mode && styles.filterBtnActive]} onPress={() => setModoGrafica(mode)}><Text style={[styles.filterText, modoGrafica === mode && styles.filterTextActive]}>{label}</Text></TouchableOpacity>);
  const TimeBtn = ({ label, mode }: { label: string; mode: string }) => (<TouchableOpacity style={[styles.timeBtn, rangoTemporal === mode && styles.timeBtnActive]} onPress={() => setRangoTemporal(mode)}><Text style={[styles.timeText, rangoTemporal === mode && styles.timeTextActive]}>{label}</Text></TouchableOpacity>);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Mi Evolución 🧬</Text>
        <TouchableOpacity onPress={() => setModalInfoVisible(true)}><Ionicons name="information-circle-outline" size={28} color="#007AFF" /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, rutinaActiva && { paddingBottom: 150 }]}>
        <View style={styles.cardGrafica}>
          <View style={styles.chartHeaderRow}>
             <Text style={styles.chartTitle}>Tendencia</Text>
             <View style={styles.timeSelectorBg}><TimeBtn label="Mes" mode="1M" /><TimeBtn label="Año" mode="1Y" /></View>
          </View>
          <View style={styles.filterRow}><FilterBtn label="Peso" mode="peso" /><FilterBtn label="% Grasa" mode="grasa" /><FilterBtn label="Músculo" mode="musculo" /></View>
          {cargando ? <ActivityIndicator color="#007AFF" style={{margin:50}} /> : datosGrafica ? (<LineChart data={datosGrafica} width={Dimensions.get('window').width - 50} height={220} yAxisSuffix={datosGrafica.suffix === '%' ? '%' : ''} chartConfig={{ backgroundGradientFrom: colores.tarjeta, backgroundGradientTo: colores.tarjeta, decimalPlaces: 1, color: (opacity = 1) => modoGrafica === 'grasa' ? `rgba(255, 59, 48, ${opacity})` : modoGrafica === 'musculo' ? `rgba(52, 199, 89, ${opacity})` : `rgba(0, 122, 255, ${opacity})`, labelColor: (opacity = 1) => `rgba(${esOscuro ? '255,255,255' : '0,0,0'}, ${opacity})`, propsForDots: { r: "4", strokeWidth: "2", stroke: "#ffa726" } }} bezier style={{ marginVertical: 10, borderRadius: 16 }} />) : (<View style={{height: 200, justifyContent:'center'}}><Text style={styles.emptyText}>No hay suficientes datos en este periodo.</Text></View>)}
        </View>

        <Text style={styles.subtitulo}>Historial Completo</Text>
        {mediciones.map((item) => (
          <View key={item.id} style={styles.cardMedicion}>
            <View style={styles.cardHeader}>
              <Text style={styles.fechaTexto}>{new Date(item.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
              <TouchableOpacity onPress={() => eliminarMedicion(item.id)}><Ionicons name="trash-outline" size={18} color="#FF3B30" /></TouchableOpacity>
            </View>
            <View style={styles.datosRow}>
              <View style={styles.datoPrincipal}><Text style={styles.datoLabel}>Peso</Text><Text style={styles.datoValorMain}>{item.peso} <Text style={{fontSize:14, color:'#666'}}>kg</Text></Text></View>
              <View style={styles.separadorVertical} />
              <View style={styles.datoSecundario}><Text style={styles.datoLabel}>Grasa</Text><Text style={[styles.datoValor, {color:'#FF9500'}]}>{item.grasa_porc ? `${item.grasa_porc}%` : '-'}</Text></View>
              <View style={styles.datoSecundario}><Text style={styles.datoLabel}>Músculo</Text><Text style={[styles.datoValor, {color:'#34C759'}]}>{item.musculo_kg ? `${item.musculo_kg} kg` : '-'}</Text></View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* BOTÓN FLOTANTE: Se mueve si hay rutina activa */}
      <TouchableOpacity 
        style={[styles.fab, rutinaActiva && { bottom: 160 }]} 
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Nueva Medición ⚖️</Text><View style={styles.inputContainer}><Text style={styles.labelInput}>Peso (kg) *</Text><TextInput style={styles.input} keyboardType="numeric" value={nuevoPeso} onChangeText={setNuevoPeso} placeholder="Ej: 75.5" autoFocus /></View><View style={styles.rowInputs}><View style={[styles.inputContainer, {flex:1, marginRight:5}]}><Text style={styles.labelInput}>Grasa (%)</Text><TextInput style={styles.input} keyboardType="numeric" value={nuevaGrasa} onChangeText={setNuevaGrasa} placeholder="Ej: 15" /></View><View style={[styles.inputContainer, {flex:1, marginLeft:5}]}><Text style={styles.labelInput}>Músculo (kg)</Text><TextInput style={styles.input} keyboardType="numeric" value={nuevoMusculo} onChangeText={setNuevoMusculo} placeholder="Ej: 60" /></View></View><View style={styles.modalButtons}><TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}><Text style={{color:'#666'}}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={styles.btnSave} onPress={guardarNuevaMedicion} disabled={guardando}><Text style={{color:'white', fontWeight:'bold'}}>{guardando ? "Guardando..." : "Guardar"}</Text></TouchableOpacity></View></View></KeyboardAvoidingView></Modal>
      <Modal visible={modalInfoVisible} transparent animationType="fade"><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Análisis de Progreso</Text><Text style={{marginBottom:20, lineHeight:20, color:'#666'}}>• Añade tu peso y mediciones regularmente.{"\n"}• Cambia entre vista mensual y anual.{"\n"}• Si tienes una báscula inteligente, introduce % de grasa y músculo.</Text><TouchableOpacity style={styles.btnCancel} onPress={() => setModalInfoVisible(false)}><Text style={{fontWeight:'bold', textAlign:'center'}}>Cerrar</Text></TouchableOpacity></View></View></Modal>
    </SafeAreaView>
  );
}

const getStyles = (colores: ColoresExtendidos) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  header: { padding: 20, backgroundColor: colores.tarjeta, borderBottomWidth: 1, borderColor: colores.borde, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: colores.texto },
  scrollContent: { padding: 15, paddingBottom: 80 }, // Padding base
  cardGrafica: { backgroundColor: colores.tarjeta, borderRadius: 20, padding: 15, marginBottom: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, elevation: 3 },
  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 15 },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: colores.texto },
  timeSelectorBg: { flexDirection: 'row', backgroundColor: colores.fondo, borderRadius: 8, padding: 2 },
  timeBtn: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6 },
  timeBtnActive: { backgroundColor: colores.tarjeta, shadowColor: '#000', shadowOpacity: 0.1, elevation: 1 },
  timeText: { fontSize: 12, color: colores.subtexto, fontWeight: '600' },
  timeTextActive: { color: colores.texto },
  filterRow: { flexDirection: 'row', backgroundColor: colores.filterBg, borderRadius: 10, padding: 3, marginBottom: 10, width:'100%', justifyContent:'space-between' },
  filterBtn: { flex:1, paddingVertical: 8, alignItems:'center', borderRadius: 8 },
  filterBtnActive: { backgroundColor: colores.tarjeta, shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 },
  filterText: { fontSize: 13, color: colores.subtexto, fontWeight: '500' },
  filterTextActive: { color: colores.primario, fontWeight: '700' },
  emptyText: { color: colores.subtexto },
  subtitulo: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginLeft: 5, color: colores.texto },
  cardMedicion: { backgroundColor: colores.tarjeta, borderRadius: 16, padding: 15, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, borderColor: colores.borde, paddingBottom: 8 },
  fechaTexto: { fontSize: 13, color: colores.subtexto, textTransform: 'capitalize', fontWeight: '500' },
  datosRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  separadorVertical: { width: 1, height: 40, backgroundColor: colores.borde },
  datoPrincipal: { alignItems: 'center', minWidth: 80 },
  datoSecundario: { alignItems: 'center', minWidth: 80 },
  datoLabel: { fontSize: 11, color: colores.subtexto, textTransform: 'uppercase', marginBottom: 2 },
  datoValorMain: { fontSize: 24, fontWeight: 'bold', color: colores.texto },
  datoValor: { fontSize: 18, fontWeight: 'bold', color: colores.texto },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: colores.primario, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, elevation: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: colores.tarjeta, width: '85%', padding: 25, borderRadius: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: colores.texto },
  inputContainer: { marginBottom: 15 },
  labelInput: { fontSize: 12, color: colores.subtexto, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: colores.borde, borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: colores.inputBg, color: colores.texto },
  rowInputs: { flexDirection: 'row', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  btnCancel: { flex: 1, padding: 15, backgroundColor: colores.btnCancelBg, borderRadius: 10, alignItems: 'center' },
  btnSave: { flex: 1, padding: 15, backgroundColor: colores.primario, borderRadius: 10, alignItems: 'center' }
});