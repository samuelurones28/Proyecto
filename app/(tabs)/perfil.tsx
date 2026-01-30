import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../components/AuthContext';
import { useAppColors } from '../../hooks/useAppColors';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PerfilScreen() {
  const { changeTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { esOscuro, colores } = useAppColors();
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [modalInfoVisible, setModalInfoVisible] = useState(false);

  const [datos, setDatos] = useState({
    id: null,
    nombre: '',
    edad: '',
    altura: '',
    sexo: '',
    objetivo: 'recomposicion',
    nivel_actividad: 'moderado',
    dias_no_disponibles: '',
    lesiones: '',
    peso: '',
    meta_kcal: '',
    meta_proteinas: '',
    meta_carbos: '',
    meta_grasas: '',
    tema: 'system'
  });

  const styles = getStyles(colores);

  useFocusEffect(
    useCallback(() => {
      cargarPerfil();
    }, [user])
  );

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Sesión', style: 'destructive', onPress: signOut }
      ]
    );
  };

  const cargarPerfil = async () => {
    if (!user) return;
    setCargando(true);
    try {
      let { data: perfilData, error } = await supabase.from('perfil').select('*').eq('user_id', user.id).limit(1);
      if (error) throw error;
      if (!perfilData || perfilData.length === 0) {
        const { data: newProfile } = await supabase.from('perfil').insert([{ user_id: user.id }]).select();
        perfilData = newProfile;
      }
      const { data: pesoData } = await supabase.from('mediciones').select('peso').eq('user_id', user.id).order('fecha', { ascending: false }).limit(1);
      
      const p = perfilData[0];
      const temaGuardado = p.tema || 'system';
      
      // Aplicar tema
      changeTheme(temaGuardado);

      setDatos({
        id: p.id,
        nombre: p.nombre || '',
        edad: p.edad ? p.edad.toString() : '',
        altura: p.altura ? p.altura.toString() : '',
        sexo: p.sexo || '',
        objetivo: p.objetivo || 'recomposicion',
        nivel_actividad: p.nivel_actividad || 'moderado',
        dias_no_disponibles: p.dias_no_disponibles || '',
        lesiones: p.lesiones || '',
        peso: pesoData?.[0]?.peso.toString() || '',
        meta_kcal: p.meta_kcal ? p.meta_kcal.toString() : '',
        meta_proteinas: p.meta_proteinas ? p.meta_proteinas.toString() : '',
        meta_carbos: p.meta_carbos ? p.meta_carbos.toString() : '',
        meta_grasas: p.meta_grasas ? p.meta_grasas.toString() : '',
        tema: temaGuardado
      });
    } catch (e) { console.error(e); } finally { setCargando(false); }
  };

  // --- FIX: GUARDADO INMEDIATO DEL TEMA ---
  const cambiarTema = async (nuevoTema) => {
      // 1. Efecto visual inmediato
      setDatos(prev => ({ ...prev, tema: nuevoTema }));
      changeTheme(nuevoTema);

      // 2. Guardado silencioso en BBDD para que no se resetee al volver
      if (datos.id) {
          await supabase.from('perfil').update({ tema: nuevoTema }).eq('id', datos.id);
      }
  };

  const guardarCambios = async () => {
    if (!datos.id || !user) return;
    setGuardando(true);
    try {
      const { error } = await supabase.from('perfil').update({
        nombre: datos.nombre,
        sexo: datos.sexo,
        edad: parseInt(datos.edad) || null,
        altura: parseInt(datos.altura) || null,
        objetivo: datos.objetivo,
        nivel_actividad: datos.nivel_actividad,
        dias_no_disponibles: datos.dias_no_disponibles,
        lesiones: datos.lesiones,
        meta_kcal: parseFloat(datos.meta_kcal) || null,
        meta_proteinas: parseFloat(datos.meta_proteinas) || null,
        meta_carbos: parseFloat(datos.meta_carbos) || null,
        meta_grasas: parseFloat(datos.meta_grasas) || null,
        tema: datos.tema
      }).eq('id', datos.id).eq('user_id', user.id);
      if (error) throw error;
      Alert.alert("Perfil actualizado", "Los cambios se han guardado correctamente.");
    } catch (e) { Alert.alert("Error", e.message); } finally { setGuardando(false); }
  };

  const toggleDiaNoDisponible = (dia) => {
    let dias = datos.dias_no_disponibles ? datos.dias_no_disponibles.split(',') : [];
    if (dias.includes(dia)) dias = dias.filter(d => d !== dia);
    else dias.push(dia);
    setDatos({ ...datos, dias_no_disponibles: dias.join(',') });
  };

  const BotonSelect = ({ valorActual, valorBoton, label, icono, descripcion, onSelect }) => (
    <TouchableOpacity 
      style={[
        styles.btnObj, 
        { 
          backgroundColor: colores.tarjeta, 
          borderColor: colores.borde,
          ...(valorActual === valorBoton ? { borderColor: colores.primario, backgroundColor: esOscuro ? '#0A84FF20' : '#EBF5FF' } : {}) 
        }
      ]} 
      onPress={() => onSelect(valorBoton)}
    >
      <View style={styles.btnRow}>
        <Text style={{ fontSize: 22 }}>{icono}</Text>
        <Text style={[styles.lblObj, { color: colores.texto }, valorActual === valorBoton && { color: colores.primario }]}>{label}</Text>
      </View>
      <Text style={[styles.descObj, { color: colores.subtexto }]}>{descripcion}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colores.fondo }]}>
      <View style={[styles.headerTop, { backgroundColor: colores.tarjeta, borderColor: colores.borde }]}>
        <Text style={[styles.tituloHeader, { color: colores.texto }]}>Mi Perfil</Text>
        <TouchableOpacity onPress={() => setModalInfoVisible(true)} style={{flexDirection: 'row', alignItems: 'center'}}>
          <Ionicons name="settings-outline" size={24} color={colores.primario} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, {backgroundColor: colores.primario}]}><Text style={styles.avatarText}>{datos.nombre ? datos.nombre.charAt(0).toUpperCase() : "A"}</Text></View>
            <Text style={{fontSize:18, fontWeight:'bold', color: colores.texto}}>{datos.nombre || "Tu Nombre"}</Text>
            {(datos.edad || datos.altura || datos.peso) && (
              <Text style={{fontSize:14, color: colores.subtexto, marginTop: 4}}>
                {[
                  datos.edad ? `${datos.edad} años` : null,
                  datos.altura ? `${datos.altura} cm` : null,
                  datos.peso ? `${datos.peso} kg` : null
                ].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>

          {cargando ? <ActivityIndicator size="large" color={colores.primario} /> : (
            <View style={[styles.form, { backgroundColor: colores.tarjeta }]}>
              <Text style={styles.seccionTitulo}>Apariencia 🎨</Text>
              <View style={styles.grid}>
                <BotonSelect valorActual={datos.tema} valorBoton="light" label="Claro" icono="☀️" descripcion="Modo día." onSelect={cambiarTema} />
                <BotonSelect valorActual={datos.tema} valorBoton="dark" label="Oscuro" icono="🌙" descripcion="Modo noche." onSelect={cambiarTema} />
                <BotonSelect valorActual={datos.tema} valorBoton="system" label="Sistema" icono="📱" descripcion="Automático." onSelect={cambiarTema} />
              </View>

              <Text style={styles.seccionTitulo}>Etapa Actual 🎯</Text>
              <View style={styles.grid}>
                <BotonSelect valorActual={datos.objetivo} valorBoton="definicion" label="Definición" icono="🔥" descripcion="Bajar grasa." onSelect={(v)=>setDatos({...datos, objetivo:v})} />
                <BotonSelect valorActual={datos.objetivo} valorBoton="recomposicion" label="Recomp." icono="⚖️" descripcion="Músculo y grasa." onSelect={(v)=>setDatos({...datos, objetivo:v})} />
                <BotonSelect valorActual={datos.objetivo} valorBoton="volumen" label="Volumen" icono="🦍" descripcion="Ganar masa." onSelect={(v)=>setDatos({...datos, objetivo:v})} />
              </View>

              <Text style={styles.seccionTitulo}>Nivel de Actividad ⚡</Text>
              <View style={styles.grid}>
                <BotonSelect valorActual={datos.nivel_actividad} valorBoton="moderado" label="Moderado" icono="🏃" descripcion="3-5 días/sem" onSelect={(v)=>setDatos({...datos, nivel_actividad:v})} />
                <BotonSelect valorActual={datos.nivel_actividad} valorBoton="activo" label="Activo" icono="🏋️" descripcion="6-7 días/sem" onSelect={(v)=>setDatos({...datos, nivel_actividad:v})} />
                <BotonSelect valorActual={datos.nivel_actividad} valorBoton="muy_activo" label="Muy Activo" icono="🚀" descripcion="Atleta / Pro" onSelect={(v)=>setDatos({...datos, nivel_actividad:v})} />
              </View>

              <Text style={styles.seccionTitulo}>Días que NO puedes entrenar 🚫</Text>
              <View style={styles.gridDias}>
                {['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map((dia) => {
                  const seleccionado = datos.dias_no_disponibles.includes(dia);
                  return (
                    <TouchableOpacity key={dia} 
                      style={[styles.diaCirculo, { borderColor: colores.borde }, seleccionado && { backgroundColor: colores.danger, borderColor: colores.danger }]} 
                      onPress={() => toggleDiaNoDisponible(dia)}
                    >
                      <Text style={[styles.diaTexto, { color: colores.subtexto }, seleccionado && {color:'white'}]}>{dia.substring(0,2).toUpperCase()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.seccionTitulo}>Datos Personales</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre</Text>
                <TextInput style={[styles.input, {backgroundColor: colores.inputBg, color: colores.texto}]} value={datos.nombre} onChangeText={(t)=>setDatos({...datos, nombre:t})} placeholder="Tu nombre" placeholderTextColor={colores.subtexto} />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, {flex:1, marginRight:10}]}>
                    <Text style={styles.label}>Edad</Text>
                    <TextInput style={[styles.input, {backgroundColor: colores.inputBg, color: colores.texto}]} value={datos.edad} keyboardType="numeric" onChangeText={(t)=>setDatos({...datos, edad:t})} placeholder="Años" placeholderTextColor={colores.subtexto} />
                </View>
                <View style={[styles.inputGroup, {flex:1, marginRight:10}]}>
                    <Text style={styles.label}>Altura (cm)</Text>
                    <TextInput style={[styles.input, {backgroundColor: colores.inputBg, color: colores.texto}]} value={datos.altura} keyboardType="numeric" onChangeText={(t)=>setDatos({...datos, altura:t})} placeholder="cm" placeholderTextColor={colores.subtexto} />
                </View>
                <View style={[styles.inputGroup, {flex:1}]}>
                    <Text style={styles.label}>Peso (kg)</Text>
                    <TextInput style={[styles.input, {backgroundColor: colores.inputBg, color: colores.texto}]} value={datos.peso} keyboardType="numeric" onChangeText={(t)=>setDatos({...datos, peso:t})} placeholder="kg" placeholderTextColor={colores.subtexto} />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Lesiones o limitaciones (opcional)</Text>
                <TextInput style={[styles.input, {backgroundColor: colores.inputBg, color: colores.texto}]} value={datos.lesiones} onChangeText={(t)=>setDatos({...datos, lesiones:t})} placeholder="Ej: Lesion de rodilla, dolor de espalda..." placeholderTextColor={colores.subtexto} multiline />
              </View>

              <Text style={styles.seccionTitulo}>Calibración Manual (Opcional)</Text>
              <View style={styles.row}>
                <View style={[styles.inputGroup, {flex:1, marginRight:5}]}>
                    <Text style={styles.label}>Kcal</Text>
                    <TextInput style={[styles.input, {backgroundColor: colores.inputBg, color: colores.texto}]} placeholder="Auto" placeholderTextColor={colores.subtexto} value={datos.meta_kcal} keyboardType="numeric" onChangeText={(t)=>setDatos({...datos, meta_kcal:t})} />
                </View>
                <View style={[styles.inputGroup, {flex:1, marginLeft:5}]}>
                    <Text style={styles.label}>Proteína</Text>
                    <TextInput style={[styles.input, {backgroundColor: colores.inputBg, color: colores.texto}]} placeholder="Auto" placeholderTextColor={colores.subtexto} value={datos.meta_proteinas} keyboardType="numeric" onChangeText={(t)=>setDatos({...datos, meta_proteinas:t})} />
                </View>
              </View>

              <TouchableOpacity style={[styles.btnGuardar, {backgroundColor: colores.primario}]} onPress={guardarCambios} disabled={guardando}>
                <Text style={styles.btnGuardarText}>{guardando ? "Guardando..." : "GUARDAR CAMBIOS"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btnGuardar, {backgroundColor: colores.danger, marginTop: 15}]} onPress={handleSignOut}>
                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8}}>
                  <Ionicons name="log-out-outline" size={20} color="white" />
                  <Text style={styles.btnGuardarText}>CERRAR SESIÓN</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={modalInfoVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {backgroundColor: colores.tarjeta}]}>
            <Text style={[styles.modalTitleEdit, {color: colores.texto}]}>Ajustes del Perfil</Text>
            <ScrollView style={{maxHeight: 300}}>
              <Text style={{marginBottom:20, lineHeight:22, color: colores.subtexto}}>
                <Text style={{fontWeight: 'bold', color: colores.texto}}>Datos Personales</Text>
                {"\n"}Tu nombre, edad, altura y peso se usan para personalizar las recomendaciones del coach IA y calcular tus necesidades calorias.
                {"\n\n"}<Text style={{fontWeight: 'bold', color: colores.texto}}>Objetivo</Text>
                {"\n"}Define tu meta actual: definicion (-400 kcal), recomposicion o volumen (+300 kcal).
                {"\n\n"}<Text style={{fontWeight: 'bold', color: colores.texto}}>Nivel de Actividad</Text>
                {"\n"}Ajusta el multiplicador de calorias segun tu frecuencia de entrenamiento.
                {"\n\n"}<Text style={{fontWeight: 'bold', color: colores.texto}}>Dias NO disponibles</Text>
                {"\n"}La IA y el calendario respetaran estos dias como descanso obligatorio.
                {"\n\n"}<Text style={{fontWeight: 'bold', color: colores.texto}}>Calibracion Manual</Text>
                {"\n"}Si prefieres establecer tus macros manualmente, estos valores tendran prioridad sobre los calculos automaticos.
              </Text>
            </ScrollView>
            <TouchableOpacity style={[styles.btnGuardar, {backgroundColor: colores.primario, marginTop:10}]} onPress={() => setModalInfoVisible(false)}>
              <Text style={{fontWeight:'bold', color:'white', textAlign:'center'}}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colores) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colores.fondo },
  headerTop: { padding: 20, borderBottomWidth: 1, borderColor: colores.borde, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tituloHeader: { fontSize: 22, fontWeight: 'bold', color: colores.texto },
  scroll: { padding: 20 },
  avatarContainer: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 10, backgroundColor: colores.primario },
  avatarText: { fontSize: 32, color: 'white', fontWeight: 'bold' },
  form: { padding: 20, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.05, elevation: 5, backgroundColor: colores.tarjeta },
  seccionTitulo: { fontSize: 14, fontWeight: 'bold', color: colores.subtexto, marginTop: 20, marginBottom: 10, textTransform: 'uppercase' },
  grid: { gap: 10, marginBottom: 5 },
  btnObj: { borderWidth: 1, borderRadius: 12, padding: 12, backgroundColor: colores.tarjeta, borderColor: colores.borde },
  btnRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  lblObj: { fontSize: 16, fontWeight: 'bold', marginLeft: 10, color: colores.texto },
  descObj: { fontSize: 12, marginLeft: 34, color: colores.subtexto },
  gridDias: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10 },
  diaCirculo: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, justifyContent: 'center', alignItems: 'center', borderColor: colores.borde, backgroundColor: colores.tarjeta },
  diaTexto: { fontSize: 11, fontWeight: 'bold', color: colores.texto },
  row: { flexDirection: 'row', marginBottom: 10 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 12, color: colores.subtexto, marginBottom: 5 },
  input: { borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: colores.inputBg, borderWidth: 1, borderColor: colores.borde, color: colores.texto },
  btnGuardar: { padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 20, backgroundColor: colores.primario },
  btnGuardarText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', padding: 25, borderRadius: 20, backgroundColor: colores.tarjeta },
  modalTitleEdit: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, color: colores.texto },
});