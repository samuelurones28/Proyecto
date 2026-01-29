import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform, useColorScheme } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../supabase';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../../components/ThemeContext';
import { useWorkout } from '../../components/WorkoutContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProgresoScreen() {
  const { theme } = useTheme();
  const { rutinaActiva } = useWorkout();
  const systemScheme = useColorScheme();
  const esOscuro = theme === 'dark' ? true : theme === 'light' ? false : systemScheme === 'dark';
  const colores = { fondo: esOscuro ? '#000000' : '#f2f2f7', tarjeta: esOscuro ? '#1c1c1e' : '#ffffff', texto: esOscuro ? '#ffffff' : '#1c1c1e', subtexto: '#8e8e93', borde: esOscuro ? '#2c2c2e' : '#eee', primario: '#007AFF', filterBg: esOscuro ? '#1c1c1e' : '#f8f9fa', inputBg: esOscuro ? '#2c2c2e' : '#f9f9f9', btnCancelBg: esOscuro ? '#2c2c2e' : '#eee' };

  const [mediciones, setMediciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalInfoVisible, setModalInfoVisible] = useState(false);
  const [modoGrafica, setModoGrafica] = useState('peso');
  const [rangoTemporal, setRangoTemporal] = useState('1M');
  const [modalVisible, setModalVisible] = useState(false);
  const [nuevoPeso, setNuevoPeso] = useState('');
  const [nuevaGrasa, setNuevaGrasa] = useState('');
  const [nuevoMusculo, setNuevoMusculo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(useCallback(() => { cargarDatos(); }, []));

  const cargarDatos = async () => {
    setCargando(true);
    try { const { data, error } = await supabase.from('mediciones').select('*').order('fecha', { ascending: false }); if (error) throw error; setMediciones(data || []); }
    catch (error) { console.error('Error:', error.message); }
    finally { setCargando(false); }
  };

  const guardarNuevaMedicion = async () => {
    if (!nuevoPeso) { Alert.alert("Falta el peso", "Introduce al menos el peso."); return; }
    setGuardando(true);
    try {
      const pesoNum = parseFloat(nuevoPeso.replace(',', '.')), grasaPorc = nuevaGrasa ? parseFloat(nuevaGrasa.replace(',', '.')) : null, musculoKg = nuevoMusculo ? parseFloat(nuevoMusculo.replace(',', '.')) : null;
      const grasaKg = grasaPorc ? (pesoNum * (grasaPorc / 100)).toFixed(2) : null, musculoPorc = musculoKg ? ((musculoKg / pesoNum) * 100).toFixed(2) : null;
      const { error } = await supabase.from('mediciones').insert({ fecha: new Date().toISOString(), peso: pesoNum, grasa_porc: grasaPorc, grasa_kg: grasaKg, musculo_kg: musculoKg, musculo_porc: musculoPorc });
      if (error) throw error;
      setModalVisible(false); setNuevoPeso(''); setNuevaGrasa(''); setNuevoMusculo(''); cargarDatos(); Alert.alert("¡Guardado!", "Progreso registrado.");
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setGuardando(false); }
  };

  const eliminarMedicion = (id) => Alert.alert("Eliminar", "¿Borrar este registro?", [{ text: "Cancelar", style: "cancel" }, { text: "Eliminar", style: "destructive", onPress: async () => { await supabase.from('mediciones').delete().eq('id', id); cargarDatos(); } }]);

  const prepararDatosGrafica = () => {
    if (!mediciones || mediciones.length < 2) return null;
    const hoy = new Date();
    let datosFiltrados = rangoTemporal === '1M' ? mediciones.filter(m => new Date(m.fecha) >= new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000)) : mediciones.filter(m => new Date(m.fecha) >= new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate()));
    if (datosFiltrados.length < 2 && rangoTemporal === '1M') datosFiltrados = [...mediciones].slice(0, 5);
    else if (datosFiltrados.length === 0) return null;
    datosFiltrados.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    if (rangoTemporal === '1Y' && datosFiltrados.length > 20) { const porMes = {}; datosFiltrados.forEach(d => { porMes[d.fecha.substring(0, 7)] = d; }); datosFiltrados = Object.values(porMes); }
    const dataPoints = modoGrafica === 'peso' ? datosFiltrados.map(m => m.peso) : modoGrafica === 'grasa' ? datosFiltrados.map(m => m.grasa_porc || 0) : datosFiltrados.map(m => m.musculo_kg || 0);
    const suffix = modoGrafica === 'grasa' ? '%' : 'kg';
    const labels = datosFiltrados.map((m, i) => { const d = new Date(m.fecha); const label = rangoTemporal === '1Y' ? d.toLocaleDateString('es-ES', { month: 'short' }) : d.getDate().toString(); return datosFiltrados.length > 6 && i % 2 !== 0 ? "" : label; });
    return { labels, datasets: [{ data: dataPoints }], suffix };
  };

  const datosGrafica = prepararDatosGrafica();
  const FilterBtn = ({ label, mode }) => <TouchableOpacity style={[styles.filterBtn, modoGrafica === mode && styles.filterBtnActive]} onPress={() => setModoGrafica(mode)}><Text style={[styles.filterText, modoGrafica === mode && styles.filterTextActive]}>{label}</Text></TouchableOpacity>;
  const TimeBtn = ({ label, mode }) => <TouchableOpacity style={[styles.timeBtn, rangoTemporal === mode && styles.timeBtnActive]} onPress={() => setRangoTemporal(mode)}><Text style={[styles.timeText, rangoTemporal === mode && styles.timeTextActive]}>{label}</Text></TouchableOpacity>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colores.fondo }]}>
      <View style={[styles.header, { backgroundColor: colores.tarjeta, borderColor: colores.borde }]}>
        <Text style={[styles.titulo, { color: colores.texto }]}>Mi Evolución 🧬</Text>
        <TouchableOpacity onPress={() => setModalInfoVisible(true)}><Ionicons name="information-circle-outline" size={28} color="#007AFF" /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={[styles.scrollContent, rutinaActiva && { paddingBottom: 150 }]}>
        <View style={[styles.cardGrafica, { backgroundColor: colores.tarjeta }]}>
          <View style={styles.chartHeaderRow}><Text style={[styles.chartTitle, { color: colores.texto }]}>Tendencia</Text><View style={[styles.timeSelectorBg, { backgroundColor: colores.fondo }]}><TimeBtn label="Mes" mode="1M" /><TimeBtn label="Año" mode="1Y" /></View></View>
          <View style={[styles.filterRow, { backgroundColor: colores.filterBg }]}><FilterBtn label="Peso" mode="peso" /><FilterBtn label="% Grasa" mode="grasa" /><FilterBtn label="Músculo" mode="musculo" /></View>
          {cargando ? <ActivityIndicator color="#007AFF" style={{ margin: 50 }} /> : datosGrafica ? <LineChart data={datosGrafica} width={Dimensions.get('window').width - 50} height={220} yAxisSuffix={datosGrafica.suffix === '%' ? '%' : ''} chartConfig={{ backgroundGradientFrom: colores.tarjeta, backgroundGradientTo: colores.tarjeta, decimalPlaces: 1, color: (o = 1) => modoGrafica === 'grasa' ? `rgba(255, 59, 48, ${o})` : modoGrafica === 'musculo' ? `rgba(52, 199, 89, ${o})` : `rgba(0, 122, 255, ${o})`, labelColor: (o = 1) => `rgba(${esOscuro ? '255,255,255' : '0,0,0'}, ${o})`, propsForDots: { r: "4", strokeWidth: "2", stroke: "#ffa726" } }} bezier style={{ marginVertical: 10, borderRadius: 16 }} /> : <View style={{ height: 200, justifyContent: 'center' }}><Text style={[styles.emptyText, { color: colores.subtexto }]}>No hay suficientes datos en este periodo.</Text></View>}
        </View>
        <Text style={[styles.subtitulo, { color: colores.texto }]}>Historial Completo</Text>
        {mediciones.map((item) => (
          <View key={item.id} style={[styles.cardMedicion, { backgroundColor: colores.tarjeta }]}>
            <View style={[styles.cardHeader, { borderColor: colores.borde }]}><Text style={[styles.fechaTexto, { color: colores.subtexto }]}>{new Date(item.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text><TouchableOpacity onPress={() => eliminarMedicion(item.id)}><Ionicons name="trash-outline" size={18} color="#FF3B30" /></TouchableOpacity></View>
            <View style={styles.datosRow}><View style={styles.datoPrincipal}><Text style={[styles.datoLabel, { color: colores.subtexto }]}>Peso</Text><Text style={[styles.datoValorMain, { color: colores.texto }]}>{item.peso} <Text style={{ fontSize: 14, color: '#666' }}>kg</Text></Text></View><View style={[styles.separadorVertical, { backgroundColor: colores.borde }]} /><View style={styles.datoSecundario}><Text style={[styles.datoLabel, { color: colores.subtexto }]}>Grasa</Text><Text style={[styles.datoValor, { color: '#FF9500' }]}>{item.grasa_porc ? `${item.grasa_porc}%` : '-'}</Text></View><View style={styles.datoSecundario}><Text style={[styles.datoLabel, { color: colores.subtexto }]}>Músculo</Text><Text style={[styles.datoValor, { color: '#34C759' }]}>{item.musculo_kg ? `${item.musculo_kg} kg` : '-'}</Text></View></View>
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity style={[styles.fab, rutinaActiva && { bottom: 160 }]} onPress={() => setModalVisible(true)}><Ionicons name="add" size={30} color="white" /></TouchableOpacity>
      <Modal visible={modalVisible} animationType="slide" transparent><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: colores.tarjeta }]}><Text style={[styles.modalTitle, { color: colores.texto }]}>Nueva Medición ⚖️</Text><View style={styles.inputContainer}><Text style={[styles.labelInput, { color: colores.subtexto }]}>Peso (kg) *</Text><TextInput style={[styles.input, { borderColor: colores.borde, backgroundColor: colores.inputBg, color: colores.texto }]} keyboardType="numeric" value={nuevoPeso} onChangeText={setNuevoPeso} placeholder="Ej: 75.5" autoFocus /></View><View style={styles.rowInputs}><View style={[styles.inputContainer, { flex: 1, marginRight: 5 }]}><Text style={[styles.labelInput, { color: colores.subtexto }]}>Grasa (%)</Text><TextInput style={[styles.input, { borderColor: colores.borde, backgroundColor: colores.inputBg, color: colores.texto }]} keyboardType="numeric" value={nuevaGrasa} onChangeText={setNuevaGrasa} placeholder="Ej: 15" /></View><View style={[styles.inputContainer, { flex: 1, marginLeft: 5 }]}><Text style={[styles.labelInput, { color: colores.subtexto }]}>Músculo (kg)</Text><TextInput style={[styles.input, { borderColor: colores.borde, backgroundColor: colores.inputBg, color: colores.texto }]} keyboardType="numeric" value={nuevoMusculo} onChangeText={setNuevoMusculo} placeholder="Ej: 60" /></View></View><View style={styles.modalButtons}><TouchableOpacity style={[styles.btnCancel, { backgroundColor: colores.btnCancelBg }]} onPress={() => setModalVisible(false)}><Text style={{ color: '#666' }}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={styles.btnSave} onPress={guardarNuevaMedicion} disabled={guardando}><Text style={{ color: 'white', fontWeight: 'bold' }}>{guardando ? "Guardando..." : "Guardar"}</Text></TouchableOpacity></View></View></KeyboardAvoidingView></Modal>
      <Modal visible={modalInfoVisible} transparent animationType="fade"><View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: colores.tarjeta }]}><Text style={[styles.modalTitle, { color: colores.texto }]}>Análisis de Progreso</Text><Text style={{ marginBottom: 20, lineHeight: 20, color: '#666' }}>• Añade tu peso y mediciones regularmente.{"\n"}• Cambia entre vista mensual y anual.{"\n"}• Si tienes una báscula inteligente, introduce % de grasa y músculo.</Text><TouchableOpacity style={[styles.btnCancel, { backgroundColor: colores.btnCancelBg }]} onPress={() => setModalInfoVisible(false)}><Text style={{ fontWeight: 'bold', textAlign: 'center' }}>Cerrar</Text></TouchableOpacity></View></View></Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 24, fontWeight: 'bold' },
  scrollContent: { padding: 15, paddingBottom: 80 },
  cardGrafica: { borderRadius: 20, padding: 15, marginBottom: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, elevation: 3 },
  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 15 },
  chartTitle: { fontSize: 16, fontWeight: 'bold' },
  timeSelectorBg: { flexDirection: 'row', borderRadius: 8, padding: 2 },
  timeBtn: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6 },
  timeBtnActive: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, elevation: 1 },
  timeText: { fontSize: 12, color: '#8e8e93', fontWeight: '600' },
  timeTextActive: { color: '#1c1c1e' },
  filterRow: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 10, width: '100%', justifyContent: 'space-between' },
  filterBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  filterBtnActive: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 },
  filterText: { fontSize: 13, color: '#8e8e93', fontWeight: '500' },
  filterTextActive: { color: '#007AFF', fontWeight: '700' },
  emptyText: { textAlign: 'center' },
  subtitulo: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginLeft: 5 },
  cardMedicion: { borderRadius: 16, padding: 15, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, paddingBottom: 8 },
  fechaTexto: { fontSize: 13, textTransform: 'capitalize', fontWeight: '500' },
  datosRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  separadorVertical: { width: 1, height: 40 },
  datoPrincipal: { alignItems: 'center', minWidth: 80 },
  datoSecundario: { alignItems: 'center', minWidth: 80 },
  datoLabel: { fontSize: 11, textTransform: 'uppercase', marginBottom: 2 },
  datoValorMain: { fontSize: 24, fontWeight: 'bold' },
  datoValor: { fontSize: 18, fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, elevation: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', padding: 25, borderRadius: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  inputContainer: { marginBottom: 15 },
  labelInput: { fontSize: 12, marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  rowInputs: { flexDirection: 'row', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  btnCancel: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' },
  btnSave: { flex: 1, padding: 15, backgroundColor: '#007AFF', borderRadius: 10, alignItems: 'center' }
});
