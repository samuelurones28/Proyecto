import { useState, useRef, memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Dimensions, Alert, ActivityIndicator, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOnboarding } from './_layout';

const { width } = Dimensions.get('window');
const DIAS = [{ id: 'lunes', label: 'LU' }, { id: 'martes', label: 'MA' }, { id: 'miercoles', label: 'MI' }, { id: 'jueves', label: 'JU' }, { id: 'viernes', label: 'VI' }, { id: 'sabado', label: 'SA' }, { id: 'domingo', label: 'DO' }];
const OBJETIVOS = [{ id: 'definicion', label: 'Definicion', icono: '🔥', desc: 'Perder grasa y marcar musculo' }, { id: 'recomposicion', label: 'Recomposicion', icono: '⚖️', desc: 'Ganar musculo y perder grasa' }, { id: 'volumen', label: 'Volumen', icono: '🦍', desc: 'Ganar masa muscular' }];
const NIVELES = [{ id: 'moderado', label: 'Moderado', icono: '🏃', desc: 'Entreno 3-5 dias por semana' }, { id: 'activo', label: 'Activo', icono: '🏋️', desc: 'Entreno 6-7 dias por semana' }, { id: 'muy_activo', label: 'Muy Activo', icono: '🚀', desc: 'Atleta o profesional del fitness' }];

// Componente InputField movido fuera para evitar recreación en cada render
const InputField = memo(({ label, value, placeholder, numeric, colores, onChangeText }: {
  label: string; value: string; placeholder: string; numeric?: boolean; colores: any; onChangeText: (t: string) => void
}) => (
  <>
    <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 10, color: colores.texto }}>{label}</Text>
    <TextInput
      style={{ borderRadius: 12, padding: 16, fontSize: 18, borderWidth: 1, backgroundColor: colores.inputBg, color: colores.texto, borderColor: colores.borde }}
      placeholder={placeholder}
      placeholderTextColor={colores.subtexto}
      value={value}
      onChangeText={onChangeText}
      keyboardType={numeric ? 'numeric' : 'default'}
    />
  </>
));

export default function OnboardingScreen() {
  const systemScheme = useColorScheme();
  const esOscuro = systemScheme === 'dark';
  const scrollRef = useRef<ScrollView>(null);
  const [pasoActual, setPasoActual] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [datos, setDatos] = useState({ nombre: '', edad: '', altura: '', peso: '', objetivo: '', nivel_actividad: '', dias_no_disponibles: '' });
  const { setOnboardingCompleto } = useOnboarding();

  const colores = useMemo(() => ({
    fondo: esOscuro ? '#000000' : '#f2f2f7', tarjeta: esOscuro ? '#1c1c1e' : '#ffffff',
    texto: esOscuro ? '#ffffff' : '#1c1c1e', subtexto: '#8e8e93',
    borde: esOscuro ? '#2c2c2e' : '#e5e5ea', inputBg: esOscuro ? '#2c2c2e' : '#f2f2f7',
    primario: '#007AFF', danger: '#FF3B30'
  }), [esOscuro]);

  const TOTAL_PASOS = 6;
  const scrollToPaso = (i: number) => { scrollRef.current?.scrollTo({ x: i * width, animated: true }); setPasoActual(i); };
  const siguiente = () => pasoActual < TOTAL_PASOS - 1 ? scrollToPaso(pasoActual + 1) : guardarPerfil();
  const anterior = () => pasoActual > 0 && scrollToPaso(pasoActual - 1);
  const setField = useCallback((field: string, val: string) => setDatos(prev => ({ ...prev, [field]: val })), []);

  // Callbacks memorizados para cada campo de texto
  const setNombre = useCallback((t: string) => setField('nombre', t), [setField]);
  const setEdad = useCallback((t: string) => setField('edad', t), [setField]);
  const setAltura = useCallback((t: string) => setField('altura', t), [setField]);
  const setPeso = useCallback((t: string) => setField('peso', t), [setField]);

  const validarPaso = (): boolean => {
    if (pasoActual === 1) return datos.nombre.trim().length > 0 && datos.edad.trim().length > 0;
    if (pasoActual === 2) return datos.altura.trim().length > 0 && datos.peso.trim().length > 0;
    if (pasoActual === 3) return datos.objetivo.length > 0;
    if (pasoActual === 4) return datos.nivel_actividad.length > 0;
    return true;
  };

  const toggleDia = (dia: string) => {
    const dias = datos.dias_no_disponibles ? datos.dias_no_disponibles.split(',').filter(d => d) : [];
    setDatos({ ...datos, dias_no_disponibles: dias.includes(dia) ? dias.filter(d => d !== dia).join(',') : [...dias, dia].join(',') });
  };

  const guardarPerfil = async () => {
    if (!validarPaso()) { Alert.alert('Campos incompletos', 'Por favor completa todos los campos requeridos.'); return; }
    setGuardando(true);
    try {
      const { data: existente } = await supabase.from('perfil').select('id').limit(1);
      const perfilData = { nombre: datos.nombre.trim(), edad: parseInt(datos.edad) || null, altura: parseInt(datos.altura) || null, objetivo: datos.objetivo, nivel_actividad: datos.nivel_actividad, dias_no_disponibles: datos.dias_no_disponibles, onboarding_completado: true, tema: 'system' };

      if (existente?.length) {
        const { error } = await supabase.from('perfil').update(perfilData).eq('id', existente[0].id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('perfil').insert([perfilData]);
        if (error) throw error;
      }
      if (datos.peso) await supabase.from('mediciones').insert([{ peso: parseFloat(datos.peso), fecha: new Date().toISOString().split('T')[0] }]);
      // Actualizar el estado del contexto ANTES de navegar para evitar el bucle
      setOnboardingCompleto(true);
      router.replace('/(tabs)');
    } catch (e: any) { Alert.alert('Error', e.message || 'No se pudo guardar el perfil'); }
    finally { setGuardando(false); }
  };

  const BotonOpcion = ({ sel, label, icono, desc, onPress }: { sel: boolean; label: string; icono: string; desc: string; onPress: () => void }) => (
    <TouchableOpacity style={[styles.btnOpcion, { backgroundColor: sel ? (esOscuro ? '#0A84FF20' : '#EBF5FF') : colores.tarjeta, borderColor: sel ? colores.primario : colores.borde }]} onPress={onPress}>
      <View style={styles.btnOpcionRow}>
        <Text style={{ fontSize: 28 }}>{icono}</Text>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={[styles.btnOpcionLabel, { color: sel ? colores.primario : colores.texto }]}>{label}</Text>
          <Text style={{ fontSize: 14, marginTop: 2, color: colores.subtexto }}>{desc}</Text>
        </View>
        {sel && <Ionicons name="checkmark-circle" size={24} color={colores.primario} />}
      </View>
    </TouchableOpacity>
  );


  const renderPaso = (i: number) => {
    if (i === 0) return (
      <View style={styles.pasoContent}>
        <Text style={{ fontSize: 80, textAlign: 'center', marginBottom: 20 }}>💪</Text>
        <Text style={[styles.pasoTitulo, { color: colores.texto }]}>Bienvenido a AI Fitness Coach</Text>
        <Text style={[styles.pasoSubtitulo, { color: colores.subtexto }]}>Tu entrenador personal con inteligencia artificial. Vamos a configurar tu perfil para personalizar tu experiencia.</Text>
      </View>
    );
    if (i === 1) return (
      <View style={styles.pasoContent}>
        <Text style={{ fontSize: 60, textAlign: 'center', marginBottom: 20 }}>👋</Text>
        <InputField label="Como te llamas?" value={datos.nombre} placeholder="Tu nombre" colores={colores} onChangeText={setNombre} />
        <View style={{ marginTop: 20 }}>
          <InputField label="Cuantos años tienes?" value={datos.edad} placeholder="Tu edad" numeric colores={colores} onChangeText={setEdad} />
        </View>
      </View>
    );
    if (i === 2) return (
      <View style={styles.pasoContent}>
        <Text style={{ fontSize: 60, textAlign: 'center', marginBottom: 20 }}>📏</Text>
        <InputField label="Cual es tu altura? (cm)" value={datos.altura} placeholder="Ej: 175" numeric colores={colores} onChangeText={setAltura} />
        <View style={{ marginTop: 20 }}>
          <InputField label="Cual es tu peso actual? (kg)" value={datos.peso} placeholder="Ej: 70" numeric colores={colores} onChangeText={setPeso} />
        </View>
      </View>
    );
    if (i === 3) return (
      <View style={styles.pasoContent}>
        <Text style={{ fontSize: 60, textAlign: 'center', marginBottom: 20 }}>🎯</Text>
        <Text style={[styles.pasoTitulo, { color: colores.texto, fontSize: 20, marginBottom: 20 }]}>Cual es tu objetivo principal?</Text>
        {OBJETIVOS.map(o => <BotonOpcion key={o.id} sel={datos.objetivo === o.id} label={o.label} icono={o.icono} desc={o.desc} onPress={() => setField('objetivo', o.id)} />)}
      </View>
    );
    if (i === 4) return (
      <View style={styles.pasoContent}>
        <Text style={{ fontSize: 60, textAlign: 'center', marginBottom: 20 }}>⚡</Text>
        <Text style={[styles.pasoTitulo, { color: colores.texto, fontSize: 20, marginBottom: 20 }]}>Cual es tu nivel de actividad?</Text>
        {NIVELES.map(n => <BotonOpcion key={n.id} sel={datos.nivel_actividad === n.id} label={n.label} icono={n.icono} desc={n.desc} onPress={() => setField('nivel_actividad', n.id)} />)}
      </View>
    );
    if (i === 5) return (
      <View style={styles.pasoContent}>
        <Text style={{ fontSize: 60, textAlign: 'center', marginBottom: 20 }}>📅</Text>
        <Text style={[styles.pasoTitulo, { color: colores.texto, fontSize: 20, marginBottom: 10 }]}>Dias que NO puedes entrenar</Text>
        <Text style={[styles.pasoSubtitulo, { color: colores.subtexto, marginBottom: 20 }]}>Selecciona los dias que tienes compromisos fijos</Text>
        <View style={styles.gridDias}>
          {DIAS.map(d => {
            const sel = datos.dias_no_disponibles.includes(d.id);
            return <TouchableOpacity key={d.id} style={[styles.diaCirculo, { borderColor: sel ? colores.danger : colores.borde, backgroundColor: sel ? colores.danger : colores.tarjeta }]} onPress={() => toggleDia(d.id)}><Text style={[styles.diaTexto, { color: sel ? '#fff' : colores.texto }]}>{d.label}</Text></TouchableOpacity>;
          })}
        </View>
        <Text style={{ textAlign: 'center', fontSize: 14, fontStyle: 'italic', color: colores.subtexto }}>Puedes dejarlo vacio si tienes disponibilidad total</Text>
      </View>
    );
    return null;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colores.fondo }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.progressContainer}>
          {Array(TOTAL_PASOS).fill(0).map((_, i) => <View key={i} style={[styles.progressDot, { backgroundColor: i <= pasoActual ? colores.primario : colores.borde, width: i === pasoActual ? 24 : 8 }]} />)}
        </View>

        <ScrollView ref={scrollRef} horizontal pagingEnabled scrollEnabled={false} showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          {Array(TOTAL_PASOS).fill(0).map((_, i) => <View key={i} style={[styles.paso, { width }]}><ScrollView contentContainerStyle={styles.pasoScroll} showsVerticalScrollIndicator={false}>{renderPaso(i)}</ScrollView></View>)}
        </ScrollView>

        <View style={[styles.botonesContainer, { backgroundColor: colores.fondo }]}>
          {pasoActual > 0 && <TouchableOpacity style={[styles.btnSecundario, { borderColor: colores.borde }]} onPress={anterior}><Ionicons name="arrow-back" size={20} color={colores.texto} /><Text style={{ fontSize: 16, fontWeight: '600', color: colores.texto }}>Atras</Text></TouchableOpacity>}
          <TouchableOpacity style={[styles.btnPrimario, { backgroundColor: validarPaso() ? colores.primario : colores.borde, flex: pasoActual === 0 ? 1 : undefined }]} onPress={siguiente} disabled={!validarPaso() || guardando}>
            {guardando ? <ActivityIndicator color="#fff" /> : <><Text style={styles.btnPrimarioText}>{pasoActual === TOTAL_PASOS - 1 ? 'Comenzar' : pasoActual === 0 ? 'Empezar' : 'Siguiente'}</Text>{pasoActual < TOTAL_PASOS - 1 && <Ionicons name="arrow-forward" size={20} color="#fff" />}</>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20, gap: 6 },
  progressDot: { height: 8, borderRadius: 4 },
  paso: { flex: 1 },
  pasoScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 30 },
  pasoContent: { alignItems: 'stretch' },
  pasoTitulo: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  pasoSubtitulo: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  inputLabel: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  input: { borderRadius: 12, padding: 16, fontSize: 18, borderWidth: 1 },
  btnOpcion: { borderWidth: 2, borderRadius: 16, padding: 16, marginBottom: 12 },
  btnOpcionRow: { flexDirection: 'row', alignItems: 'center' },
  btnOpcionLabel: { fontSize: 18, fontWeight: 'bold' },
  gridDias: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 20 },
  diaCirculo: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  diaTexto: { fontSize: 12, fontWeight: 'bold' },
  botonesContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 20, gap: 12 },
  btnSecundario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1, gap: 8 },
  btnPrimario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, gap: 8, flex: 1 },
  btnPrimarioText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
