import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import BarcodeScanner from '../../components/BarcodeScanner';
import { useWorkout } from '../../components/WorkoutContext';
import { useAuth } from '../../components/AuthContext';
import { useAppColors } from '../../hooks/useAppColors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GROQ_API_KEY, GROQ_MODEL, GROQ_VISION_MODEL } from '../../config';
import { sanitizeFullTextSearch, sanitizeILike } from '../../utils/sanitize'; 

export default function NutricionScreen() {
  const { user } = useAuth();
  const { esOscuro, colores } = useAppColors();

  const { rutinaActiva } = useWorkout();
  const [cargando, setCargando] = useState(false);
  const [cargandoMacros, setCargandoMacros] = useState(false);
  const [mostrarEscaner, setMostrarEscaner] = useState(false);
  
  const [modalEditVisible, setModalEditVisible] = useState(false);
  const [modalBuscarVisible, setModalBuscarVisible] = useState(false);
  const [modalInfoVisible, setModalInfoVisible] = useState(false);

  const [comidasHoy, setComidasHoy] = useState([]);
  const [resumen, setResumen] = useState({ kcal: 0, protes: 0, carbos: 0, grasas: 0 });
  const [objetivos, setObjetivos] = useState({ kcal: 2000, protes: 150, carbos: 200, grasas: 70 });
  
  const [esDiaEntreno, setEsDiaEntreno] = useState(false);
  const [nivelDetectado, setNivelDetectado] = useState("Cargando..."); 

  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [alimentoTemp, setAlimentoTemp] = useState(null); 
  const [modoBusqueda, setModoBusqueda] = useState('recientes');

  useFocusEffect(useCallback(() => { inicializarPantalla(); }, [user]));

  const inicializarPantalla = async () => { if (!user) return; await Promise.all([cargarDiario(), calcularMetasDiarias()]); };
  
  const calcularMetasDiarias = async () => {
    if (!user) return;
    try {
      const { data: perfilData } = await supabase.from('perfil').select('*').eq('user_id', user.id).limit(1);
      const { data: medicionData } = await supabase.from('mediciones').select('peso, grasa_porc').eq('user_id', user.id).order('fecha', { ascending: false }).limit(1);
      const hoyISO = new Date().toISOString().split('T')[0];
      const { data: calendarioData } = await supabase.from('calendario_acciones').select('estado').eq('user_id', user.id).eq('fecha', hoyISO).maybeSingle();

      const usuario = perfilData?.[0] || {};
      const tieneManual = (usuario.meta_kcal && parseFloat(usuario.meta_kcal) > 0);
      
      if (tieneManual) {
        setNivelDetectado("MANUAL (Prioridad)");
        setObjetivos({ kcal: usuario.meta_kcal, protes: usuario.meta_proteinas || 150, carbos: usuario.meta_carbos || 200, grasas: usuario.meta_grasas || 70 });
        const esEntrenoVisual = calendarioData?.estado === 'completado' || (!calendarioData && usuario.nivel_actividad !== 'sedentario');
        setEsDiaEntreno(esEntrenoVisual);
        return;
      }

      const peso = medicionData?.[0]?.peso || 78;
      const grasaPorcentaje = medicionData?.[0]?.grasa_porc || 20;
      const actividad = usuario.nivel_actividad || 'moderado';
      setNivelDetectado(actividad.toUpperCase());

      const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const hoyNombre = diasSemana[new Date().getDay()]; 
      const diasProhibidos = (usuario.dias_no_disponibles || "").toLowerCase();

      const { data: planData } = await supabase.from('planes_semanales').select('datos_semana').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
      
      let entrenoHoy = false;

      if (calendarioData?.estado === 'completado') { entrenoHoy = true; setNivelDetectado("COMPLETADO (Manual)"); } 
      else if (calendarioData?.estado === 'descanso_extra') { entrenoHoy = false; setNivelDetectado("DESCANSO (Manual)"); }
      else if (diasProhibidos.includes(hoyNombre)) { entrenoHoy = false; setNivelDetectado(`DÍA BLOQUEADO (${hoyNombre})`); }
      else if (planData && planData.length > 0) {
        const rutinaDia = planData[0].datos_semana[hoyNombre];
        if (rutinaDia && rutinaDia.titulo !== 'Descanso' && rutinaDia.ejercicios?.length > 0) { entrenoHoy = true; }
      }
      
      setEsDiaEntreno(entrenoHoy);

      const masaGrasa = peso * (grasaPorcentaje / 100);
      const masaMagra = peso - masaGrasa; 
      const tmb = 370 + (21.6 * masaMagra);
      const factores = { 'sedentario': 1.2, 'ligero': 1.375, 'moderado': 1.55, 'activo': 1.725, 'muy_activo': 1.9 };
      const factor = factores[actividad] || 1.55; 

      let objetivoKcal = Math.round(tmb * factor);
      const objetivoUsuario = usuario.objetivo || 'recomposicion';
      if (objetivoUsuario === 'definicion') { objetivoKcal -= 400; } 
      else if (objetivoUsuario === 'volumen') { objetivoKcal += 300; }

      if (!entrenoHoy) { objetivoKcal -= 200; } else { objetivoKcal += 200; }

      const protes = Math.round(peso * 2.2); 
      const grasas = Math.round(peso * 0.9);
      const kcalOcupadas = (protes * 4) + (grasas * 9);
      const carbos = Math.max(0, Math.round((objetivoKcal - kcalOcupadas) / 4));

      setObjetivos({ kcal: objetivoKcal, protes, grasas, carbos });

    } catch (e) { console.error(e); }
  };

  const cargarDiario = async () => {
    if (!user) return;
    const hoy = new Date();
    const hoyISO = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())).toISOString();
    const { data } = await supabase.from('comidas').select('*').eq('user_id', user.id).gte('created_at', hoyISO).order('created_at', { ascending: false });
    if (data) { setComidasHoy(data); calcularResumen(data); }
  };

  const calcularResumen = (comidas) => {
    const total = comidas.reduce((acc, item) => ({
      kcal: acc.kcal + (item.calorias || 0), protes: acc.protes + (item.proteinas || 0), carbos: acc.carbos + (item.carbos || 0), grasas: acc.grasas + (item.grasas || 0),
    }), { kcal: 0, protes: 0, carbos: 0, grasas: 0 });
    setResumen(total);
  };

  const elegirFoto = async () => {
    // Solicitar permiso de cámara
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos acceso a la cámara para analizar tus comidas. Por favor, habilita el permiso en la configuración de tu dispositivo.',
        [{ text: 'OK' }]
      );
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5
    });

    if (!result.canceled) analizarConIA(result.assets[0].uri);
  };

  const analizarConIA = async (uri) => {
    setCargando(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

      console.log('Enviando petición a Groq con modelo:', GROQ_VISION_MODEL);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `Analiza esta imagen de comida. 1. Describe qué ves y estima los ingredientes. 2. ESTIMA el peso total visual en gramos (sé preciso, arriesga una cifra lógica). 3. Identifica el nombre del plato. 4. Calcula macros por 100g. Responde ÚNICAMENTE con este JSON: { "nombre": "Nombre Corto", "explicacion": "Texto completo...", "peso_estimado_g": 0, "kcal_100g": 0, "p_100g": 0, "c_100g": 0, "f_100g": 0 }` },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
              ]
            }
          ],
          model: GROQ_VISION_MODEL,
          temperature: 0.1,
          max_tokens: 1000
        })
      });

      const jsonResponse = await response.json();
      console.log('Respuesta de Groq:', JSON.stringify(jsonResponse, null, 2));

      if (jsonResponse.error) {
        console.error('Error de API:', jsonResponse.error);
        throw new Error(jsonResponse.error.message);
      }

      const responseText = jsonResponse.choices[0]?.message?.content || "";
      console.log('Texto de respuesta:', responseText);

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.error('No se encontró JSON en la respuesta');
        throw new Error("No se pudo leer la respuesta de la IA.");
      }

      const data = JSON.parse(jsonMatch[0]);
      console.log('Datos parseados:', data);

      prepararEdicion({
          nombre: data.nombre,
          descripcion: data.explicacion,
          cantidad: data.peso_estimado_g,
          macros_100g: { kcal: data.kcal_100g, p: data.p_100g, c: data.c_100g, f: data.f_100g }
      });

    } catch (e) {
        console.error('Error completo en analizarConIA:', e);
        const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
        Alert.alert("Error IA", `No pude identificar el alimento.\n\nError: ${errorMsg}`);
    } finally {
        setCargando(false);
    }
  };

  const recalcularMacrosPorNombre = async () => {
    if (!alimentoTemp?.nombre) return;
    setCargandoMacros(true);
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                { role: "system", content: "Eres un nutricionista experto. Responde siempre y únicamente con un objeto JSON." },
                { role: "user", content: `Dame la información nutricional aproximada por 100g de este alimento exacto: "${alimentoTemp.nombre}". Responde ÚNICAMENTE con este JSON: { "kcal_100g": 0, "p_100g": 0, "c_100g": 0, "f_100g": 0 }` }
              ],
              model: GROQ_MODEL, 
              temperature: 0.1,
              max_tokens: 1000
            })
        });

        const jsonResponse = await response.json();
        if (jsonResponse.error) throw new Error(jsonResponse.error.message);
        const text = jsonResponse.choices[0]?.message?.content || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            const nuevosMacrosBase = { kcal: data.kcal_100g, p: data.p_100g, c: data.c_100g, f: data.f_100g };
            setAlimentoTemp(prev => ({
                ...prev,
                macros_100g: nuevosMacrosBase,
                macros_finales: calcularMacros(nuevosMacrosBase, parseFloat(prev.cantidad) || 100)
            }));
            Alert.alert("Actualizado", `Macros actualizados para: ${alimentoTemp.nombre}`);
        } else { throw new Error("No se encontraron datos"); }
    } catch (e) { Alert.alert("Error", "No se pudo recalcular."); } finally { setCargandoMacros(false); }
  };

  const buscarProductoAPI = async (codigo) => {
    setMostrarEscaner(false); setCargando(true);
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${codigo}.json`);
      const data = await response.json();
      if (data.status === 1) {
        const p = data.product;
        let pesoPorcion = null;
        if (p.serving_quantity) pesoPorcion = parseFloat(p.serving_quantity);
        let qty = pesoPorcion || 100;

        prepararEdicion({ 
            nombre: p.product_name || "Producto", 
            cantidad: qty, 
            peso_porcion: pesoPorcion, 
            macros_100g: { 
                kcal: p.nutriments["energy-kcal_100g"]||0, 
                p: p.nutriments.proteins_100g||0, 
                c: p.nutriments.carbohydrates_100g||0, 
                f: p.nutriments.fat_100g||0 
            } 
        });
      } else { Alert.alert("No encontrado", "Intenta búsqueda manual."); }
    } catch (e) { Alert.alert("Error", e.message); } finally { setCargando(false); }
  };

  const cargarRecientes = async () => {
    if (!user) return;
    setModoBusqueda('recientes');
    setTextoBusqueda('');
    const { data } = await supabase.from('comidas').select('nombre, datos_base, peso_porcion').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (data) filtrarYSetearResultados(data);
  };

  const buscarEnHistorial = async (texto) => {
    if (!user) return;
    setTextoBusqueda(texto);
    if (texto.length === 0) { cargarRecientes(); return; }
    if (texto.length < 2) { setResultadosBusqueda([]); return; }
    setModoBusqueda('busqueda');

    // Sanitizar input antes de usar en queries
    const textoSanitizado = sanitizeFullTextSearch(texto);
    const textoILike = sanitizeILike(texto);

    try {
        const { data: dataSearch, error } = await supabase.from('comidas').select('nombre, datos_base, peso_porcion').eq('user_id', user.id).textSearch('nombre', textoSanitizado, { config: 'spanish', type: 'websearch' }).limit(15);
        if (!error && dataSearch && dataSearch.length > 0) { filtrarYSetearResultados(dataSearch); return; }
    } catch (e) {}
    const { data } = await supabase.from('comidas').select('nombre, datos_base, peso_porcion').eq('user_id', user.id).ilike('nombre', `%${textoILike}%`).limit(15);
    if (data) filtrarYSetearResultados(data);
  };

  const filtrarYSetearResultados = (data) => {
      const unicos = [];
      const vistos = new Set();
      data.forEach(i => {
          const nombreNorm = i.nombre.toLowerCase().trim();
          if (!vistos.has(nombreNorm) && i.datos_base) {
              vistos.add(nombreNorm);
              unicos.push(i);
          }
      });
      setResultadosBusqueda(unicos.slice(0, 15));
  };
  
  const seleccionarDelHistorial = (item) => { 
    setModalBuscarVisible(false); 
    const macros = item.datos_base || { kcal: 0, p: 0, c: 0, f: 0 }; 
    prepararEdicion({ nombre: item.nombre, macros_100g: macros, cantidad: 100, peso_porcion: item.peso_porcion }); 
  };
  
  const crearNuevoManual = () => { setModalBuscarVisible(false); prepararEdicion({ nombre: textoBusqueda||"Nuevo", cantidad: 100, macros_100g: { kcal: 0, p: 0, c: 0, f: 0 } }); };
  
  const prepararEdicion = (datosBase, esEdicion = false, id = null) => { 
    const macros = datosBase.macros_100g || datosBase.datos_base || { kcal: 0, p: 0, c: 0, f: 0 };
    setAlimentoTemp({ 
      id, 
      nombre: datosBase.nombre, 
      descripcion: datosBase.descripcion || "", 
      cantidad: datosBase.cantidad||100, 
      peso_porcion: datosBase.peso_porcion || '', 
      macros_100g: macros, 
      macros_finales: calcularMacros(macros, datosBase.cantidad||100) 
    }); 
    setModalEditVisible(true); 
  };

  const calcularMacros = (base, gramos) => { 
    if (!base) return { kcal: 0, p: 0, c: 0, f: 0 }; 
    const ratio = gramos/100; 
    return { kcal: (base.kcal*ratio).toFixed(0), p: (base.p*ratio).toFixed(1), c: (base.c*ratio).toFixed(1), f: (base.f*ratio).toFixed(1) }; 
  };

  const actualizarTemp = (campo, valor) => { 
    if (campo === 'nombre') { setAlimentoTemp({ ...alimentoTemp, nombre: valor }); return; }
    if (campo === 'descripcion') { setAlimentoTemp({ ...alimentoTemp, descripcion: valor }); return; } 

    const valorVisual = valor; 
    const valorNumericoStr = valor.replace(',', '.');
    
    if (campo === 'peso_porcion') { setAlimentoTemp({ ...alimentoTemp, peso_porcion: valorVisual }); return; }

    const nuevo = { ...alimentoTemp, [campo]: valorVisual }; 
    const macros = nuevo.macros_100g || { kcal: 0, p: 0, c: 0, f: 0 }; 
    
    const esNumeroValido = !isNaN(parseFloat(valorNumericoStr)) || valorNumericoStr === '' || valorNumericoStr === '.';

    if (esNumeroValido) {
        if (campo === 'cantidad') {
            nuevo.macros_finales = calcularMacros(macros, parseFloat(valorNumericoStr)||0); 
        }
        if (campo.startsWith('base_')) { 
            const k = campo.replace('base_', ''); 
            if (!nuevo.macros_100g) nuevo.macros_100g = { kcal: 0, p: 0, c: 0, f: 0 };
            nuevo.macros_100g[k] = valorVisual; 
            const macrosParaCalculo = { ...nuevo.macros_100g };
            macrosParaCalculo[k] = parseFloat(valorNumericoStr) || 0;
            nuevo.macros_finales = calcularMacros(macrosParaCalculo, parseFloat(nuevo.cantidad)||0); 
        } 
    }
    setAlimentoTemp(nuevo); 
  };

  const usarPorcion = () => {
      const pesoPorcion = parseFloat(alimentoTemp.peso_porcion.toString().replace(',', '.'));
      if (pesoPorcion > 0) {
          actualizarTemp('cantidad', pesoPorcion.toString());
      }
  };

  const guardarEnDB = async () => {
    if (!user) return;
    const { nombre, cantidad, macros_100g, macros_finales, id, peso_porcion } = alimentoTemp;
    const cleanFloat = (val) => { if (typeof val === 'string') return parseFloat(val.replace(',', '.')) || 0; return parseFloat(val) || 0; };
    const macrosLimpios = { kcal: cleanFloat(macros_100g.kcal), p: cleanFloat(macros_100g.p), c: cleanFloat(macros_100g.c), f: cleanFloat(macros_100g.f) };
    const d = {
      user_id: user.id,
      nombre,
      cantidad: cleanFloat(cantidad),
      peso_porcion: cleanFloat(peso_porcion),
      unidad: 'g',
      datos_base: macrosLimpios,
      calorias: parseFloat(macros_finales.kcal),
      proteinas: parseFloat(macros_finales.p),
      carbos: parseFloat(macros_finales.c),
      grasas: parseFloat(macros_finales.f)
    };

    let error;
    if (id) { const res = await supabase.from('comidas').update(d).eq('id', id).eq('user_id', user.id); error = res.error; }
    else { const res = await supabase.from('comidas').insert(d); error = res.error; }

    if (error) { Alert.alert("Error al guardar", error.message); }
    else { setModalEditVisible(false); cargarDiario(); }
  };

  const borrarComida = async (id) => { Alert.alert("Borrar", "¿Seguro?", [{text:"Cancelar"}, {text:"Sí", style:"destructive", onPress: async ()=>{ if (user) { await supabase.from('comidas').delete().eq('id', id).eq('user_id', user.id); cargarDiario(); } }}]); };

  const BotonFooter = ({icon, text, color, onPress}) => (<TouchableOpacity style={[styles.botonFooter, {backgroundColor: color === '#333' && esOscuro ? '#444' : color}]} onPress={onPress}><Ionicons name={icon} size={20} color="white" /><Text style={styles.textFooter}>{text}</Text></TouchableOpacity>);
  
  const InputMacro = ({label, val, onChange}) => (
    <View style={{flex:1, alignItems:'center'}}>
        <Text style={{fontSize:10, color: colores.subtexto}}>{label}</Text>
        <TextInput style={[styles.inputSmall, {borderColor: colores.borde, color: colores.texto}]} keyboardType="decimal-pad" value={val?.toString()} onChangeText={onChange} placeholder="0" placeholderTextColor={colores.subtexto} />
    </View>
  );
  
  const MacroBadge = ({val, target, label, color}) => (<View style={{alignItems:'center'}}><Text style={{fontSize:18, fontWeight:'900', color: color}}>{val}</Text><Text style={{fontSize:10, color: colores.subtexto}}> / {target}g</Text><Text style={{fontSize:12, color: colores.texto, fontWeight:'600'}}>{label}</Text></View>);

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colores.fondo}]}>
      <View style={[styles.headerResumen, {backgroundColor: colores.tarjeta}]}>
        <View style={styles.topRow}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1}}>
            <Text style={[styles.tituloHeader, {color: colores.texto}]}>Diario de Hoy</Text>
            <TouchableOpacity onPress={() => setModalInfoVisible(true)}>
              <Ionicons name="information-circle-outline" size={24} color={colores.primario} />
            </TouchableOpacity>
          </View>
          <View style={{alignItems:'flex-end'}}>
            {esDiaEntreno ? <View style={[styles.badgeEntreno, {backgroundColor:'#e3f2fd'}]}><Text style={{color:'#007AFF', fontWeight:'bold', fontSize:12}}>🏋️ Entreno</Text></View> : <View style={[styles.badgeEntreno, {backgroundColor: esOscuro ? '#2c2c2e' : '#eee'}]}><Text style={{color: colores.subtexto, fontWeight:'bold', fontSize:12}}>💤 Descanso</Text></View>}
            <Text style={{fontSize:10, color: colores.subtexto, marginTop:2}}>Nivel: {nivelDetectado}</Text>
          </View>
        </View>
        <View style={styles.kcalContainer}>
           <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:5}}><Text style={[styles.kcalLabel, {color: colores.subtexto}]}>Calorías</Text><Text style={[styles.kcalNums, {color: colores.texto}]}><Text style={{fontWeight:'bold', color: resumen.kcal > objetivos.kcal ? '#FF3B30' : '#007AFF'}}>{resumen.kcal.toFixed(0)}</Text> / {objetivos.kcal}</Text></View>
           <View style={[styles.barraFondo, {backgroundColor: colores.borde}]}><View style={[styles.barraProgreso, { width: `${Math.min((resumen.kcal / objetivos.kcal) * 100, 100)}%`, backgroundColor: resumen.kcal > objetivos.kcal ? '#FF3B30' : '#007AFF' }]} /></View>
        </View>
        <View style={styles.macrosRow}><MacroBadge val={resumen.protes.toFixed(0)} target={objetivos.protes} label="Prot" color="#8e44ad" /><MacroBadge val={resumen.carbos.toFixed(0)} target={objetivos.carbos} label="Carb" color="#f39c12" /><MacroBadge val={resumen.grasas.toFixed(0)} target={objetivos.grasas} label="Grasa" color="#27ae60" /></View>
      </View>
      
      <View style={{ flex: 1, paddingBottom: rutinaActiva ? 90 : 0 }}>
        <View style={styles.listaContainer}>
            <FlatList data={comidasHoy} keyExtractor={item => item.id.toString()} ListEmptyComponent={<Text style={{textAlign:'center', marginTop:50, color: colores.subtexto}}>Registra tu primera comida.</Text>} renderItem={({ item }) => <View style={[styles.foodCard, {backgroundColor: colores.tarjeta}]}><View style={{flex: 1}}><Text style={[styles.foodName, {color: colores.texto}]}>{item.nombre}</Text><Text style={[styles.foodDetails, {color: colores.subtexto}]}>{item.cantidad}g • {item.calorias} kcal</Text></View><View style={styles.acciones}><TouchableOpacity onPress={() => prepararEdicion(item, true, item.id)}><Ionicons name="pencil" size={20} color="#007AFF" /></TouchableOpacity><TouchableOpacity onPress={() => borrarComida(item.id)}><Ionicons name="trash-outline" size={20} color="#FF3B30" style={{marginLeft:10}} /></TouchableOpacity></View></View>} />
        </View>
        
        <View style={[styles.footer, {backgroundColor: colores.tarjeta}]}>
            <BotonFooter icon="camera" text="Foto IA" color="#007AFF" onPress={elegirFoto} />
            <BotonFooter icon="barcode-outline" text="Escanear" color="#333" onPress={() => setMostrarEscaner(true)} />
            <BotonFooter icon="create-outline" text="Manual" color="#28a745" onPress={() => { cargarRecientes(); setModalBuscarVisible(true); }} />
        </View>
      </View>

      <Modal visible={mostrarEscaner} animationType="slide"><BarcodeScanner onScanned={buscarProductoAPI} onClose={() => setMostrarEscaner(false)} /></Modal>
      
      <Modal visible={modalBuscarVisible} animationType="slide">
        <SafeAreaView style={[styles.modalFull, {backgroundColor: colores.fondo}]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, {color: colores.texto}]}>Añadir Alimento</Text><TouchableOpacity onPress={() => setModalBuscarVisible(false)}><Ionicons name="close" size={28} color={colores.texto} /></TouchableOpacity></View>
            <View style={[styles.searchBox, {backgroundColor: colores.tarjeta}]}><Ionicons name="search" size={20} color={colores.subtexto} /><TextInput style={[styles.searchInput, {color: colores.texto}]} placeholder="Buscar..." placeholderTextColor={colores.subtexto} value={textoBusqueda} onChangeText={buscarEnHistorial} autoFocus /></View>
            <Text style={{marginLeft: 20, marginBottom: 5, fontSize: 12, color: colores.subtexto, fontWeight: 'bold', textTransform: 'uppercase'}}>{modoBusqueda === 'recientes' ? 'Últimos consumidos' : 'Resultados de búsqueda'}</Text>
            <FlatList data={resultadosBusqueda} keyExtractor={(item, i) => i.toString()} ListEmptyComponent={textoBusqueda.length > 0 ? (<TouchableOpacity style={styles.createNewBtn} onPress={crearNuevoManual}><Text style={styles.createNewText}>+ Crear "{textoBusqueda}"</Text></TouchableOpacity>) : (<Text style={{textAlign:'center', marginTop:50, color: colores.subtexto}}>No hay datos recientes.</Text>)} renderItem={({ item }) => (<TouchableOpacity style={[styles.historyItem, {backgroundColor: colores.tarjeta, borderColor: colores.borde}]} onPress={() => seleccionarDelHistorial(item)}><Ionicons name={modoBusqueda === 'recientes' ? "time-outline" : "search-outline"} size={20} color={colores.subtexto} /><Text style={[styles.historyText, {color: colores.texto}]}>{item.nombre}</Text></TouchableOpacity>)} />
        </SafeAreaView>
      </Modal>

      <Modal visible={modalEditVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: colores.tarjeta}]}>
                
                {alimentoTemp?.descripcion ? (
                    <View style={{marginBottom: 15}}>
                        <Text style={{fontSize: 12, color: colores.primario, fontWeight: 'bold', marginBottom: 5}}>Análisis de la IA (Puedes corregir):</Text>
                        <TextInput 
                            style={{backgroundColor: colores.inputBg, color: colores.texto, borderRadius: 8, padding: 10, height: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: colores.borde}}
                            multiline
                            value={alimentoTemp?.descripcion}
                            onChangeText={(t) => actualizarTemp('descripcion', t)}
                        />
                    </View>
                ) : null}

                <View style={{flexDirection:'row', alignItems:'center', borderBottomWidth:1, borderColor: colores.borde, marginBottom: 15, paddingBottom: 5}}>
                    <TextInput style={[styles.modalTitleEdit, {color: colores.texto, marginBottom: 0, flex: 1}]} value={alimentoTemp?.nombre} onChangeText={(t) => actualizarTemp('nombre', t)}/>
                    <Ionicons name="pencil" size={18} color={colores.subtexto} style={{marginLeft: 10}}/>
                </View>
                
                <TouchableOpacity style={{backgroundColor: '#e3f2fd', padding:8, borderRadius:8, alignSelf:'center', marginBottom:15, flexDirection:'row', alignItems:'center', gap:5}} onPress={recalcularMacrosPorNombre} disabled={cargandoMacros}>{cargandoMacros ? <ActivityIndicator size="small" color="#007AFF"/> : <Ionicons name="sparkles" size={16} color="#007AFF" />}<Text style={{color:'#007AFF', fontWeight:'bold', fontSize:12}}>{cargandoMacros ? "Calculando..." : "Actualizar macros según nombre"}</Text></TouchableOpacity>

                <View style={styles.rowCenter}><TextInput style={[styles.inputBig, {color: colores.texto, borderColor: colores.primario}]} keyboardType="decimal-pad" value={alimentoTemp?.cantidad.toString()} onChangeText={(t)=>actualizarTemp('cantidad', t)} /><Text style={{fontSize: 18, color: colores.subtexto}}>g</Text></View>

                {/* AQUÍ ESTÁ EL BOTÓN DE PORCIÓN RECUPERADO */}
                {alimentoTemp?.peso_porcion && parseFloat(alimentoTemp.peso_porcion) > 0 && (
                    <TouchableOpacity style={{backgroundColor: '#e3f2fd', padding:8, borderRadius:8, alignSelf:'center', marginBottom:15}} onPress={usarPorcion}>
                        <Text style={{color:'#007AFF', fontWeight:'bold', fontSize:12}}>Usar 1 unidad ({alimentoTemp.peso_porcion}g)</Text>
                    </TouchableOpacity>
                )}

                {/* NUEVO: Muestra los valores reales calculados para los gramos actuales */}
                <View style={[styles.macrosPreview, {backgroundColor: esOscuro ? '#2c2c2e' : '#f0f8ff', padding: 15, marginBottom: 15}]}>
                    <Text style={{fontWeight:'bold', color: colores.texto, marginBottom: 5, textAlign:'center'}}>
                        Valores para {alimentoTemp?.cantidad || 0}g:
                    </Text>
                    <View style={{flexDirection:'row', justifyContent:'space-around'}}>
                        <Text style={{color: colores.texto, fontSize:12}}><Text style={{fontWeight:'bold'}}>{alimentoTemp?.macros_finales.kcal}</Text> Kcal</Text>
                        <Text style={{color: colores.texto, fontSize:12}}><Text style={{fontWeight:'bold'}}>{alimentoTemp?.macros_finales.p}</Text> P</Text>
                        <Text style={{color: colores.texto, fontSize:12}}><Text style={{fontWeight:'bold'}}>{alimentoTemp?.macros_finales.c}</Text> C</Text>
                        <Text style={{color: colores.texto, fontSize:12}}><Text style={{fontWeight:'bold'}}>{alimentoTemp?.macros_finales.f}</Text> G</Text>
                    </View>
                </View>
                
                {/* CAMPO PARA EDITAR LA PORCIÓN MANUALMENTE */}
                <Text style={[styles.labelSmall, {color: colores.subtexto, marginTop: 5, textAlign:'center'}]}>Peso de 1 unidad/porción (g):</Text>
                <TextInput 
                    style={[styles.inputSmall, {borderColor: colores.borde, color: colores.texto, marginBottom: 15, width:'50%', alignSelf:'center'}]} 
                    keyboardType="decimal-pad" 
                    value={alimentoTemp?.peso_porcion?.toString()} 
                    onChangeText={(t)=>actualizarTemp('peso_porcion', t)} 
                    placeholder="Ej: 150" 
                    placeholderTextColor={colores.subtexto} 
                />

                <Text style={[styles.labelSmall, {color: colores.subtexto}]}>Info nutricional por 100g (Base):</Text>
                <View style={styles.gridMacros}><InputMacro label="Kcal" val={alimentoTemp?.macros_100g.kcal} onChange={(t)=>actualizarTemp('base_kcal', t)} /><InputMacro label="P" val={alimentoTemp?.macros_100g.p} onChange={(t)=>actualizarTemp('base_p', t)} /><InputMacro label="C" val={alimentoTemp?.macros_100g.c} onChange={(t)=>actualizarTemp('base_c', t)} /><InputMacro label="F" val={alimentoTemp?.macros_100g.f} onChange={(t)=>actualizarTemp('base_f', t)} /></View>
                <View style={styles.modalBtns}><TouchableOpacity onPress={() => setModalEditVisible(false)} style={styles.btnCancel}><Text>Cancelar</Text></TouchableOpacity><TouchableOpacity onPress={guardarEnDB} style={styles.btnSave}><Text style={{color:'white', fontWeight:'bold'}}>Guardar</Text></TouchableOpacity></View>
            </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalInfoVisible} transparent animationType="fade"><View style={styles.modalOverlay}><View style={[styles.modalContent, {backgroundColor: colores.tarjeta}]}><Text style={[styles.modalTitle, {color: colores.texto}]}>Nutrición</Text><Text style={{marginBottom:20, lineHeight:20, color: colores.subtexto}}>• Controla tus macros y calorías diarias.{"\n"}• Escanea o busca alimentos manualmente.</Text><TouchableOpacity style={[styles.btnCancel, {backgroundColor: colores.primario}]} onPress={() => setModalInfoVisible(false)}><Text style={{fontWeight:'bold', color:'white', textAlign:'center'}}>Cerrar</Text></TouchableOpacity></View></View></Modal>
      {cargando && <View style={styles.loading}><ActivityIndicator size="large" color="#fff" /></View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  headerResumen: { padding: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 5 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  tituloHeader: { fontSize: 22, fontWeight: 'bold' },
  badgeEntreno: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  txtEntreno: { fontWeight: 'bold', fontSize: 12 },
  kcalContainer: { marginBottom: 20 },
  kcalLabel: { fontSize: 14, fontWeight: '600' },
  kcalNums: { fontSize: 14 },
  barraFondo: { height: 10, borderRadius: 5, marginTop: 5, overflow: 'hidden' },
  barraProgreso: { height: '100%', borderRadius: 5 },
  macrosRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 },
  listaContainer: { flex: 1, padding: 15 },
  foodCard: { padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  foodName: { fontWeight: 'bold', fontSize: 16 },
  foodDetails: { fontSize: 13 },
  acciones: { flexDirection: 'row' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999' },
  footer: { flexDirection: 'row', padding: 15, gap: 10 },
  botonFooter: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  textFooter: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  modalFull: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  searchBox: { flexDirection: 'row', margin: 15, padding: 12, borderRadius: 10, alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 16 },
  historyItem: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, alignItems: 'center', gap: 10 },
  historyText: { fontSize: 16 },
  createNewBtn: { padding: 20, alignItems: 'center' },
  createNewText: { color: '#007AFF', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', padding: 25, borderRadius: 20 },
  modalTitleEdit: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  rowCenter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginBottom: 20 },
  inputBig: { fontSize: 32, fontWeight: 'bold', borderBottomWidth: 2, textAlign: 'center', width: 100 },
  macrosPreview: { padding: 10, borderRadius: 8, marginBottom: 15, alignItems: 'center' },
  labelSmall: { fontSize: 12, marginBottom: 5 },
  gridMacros: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  inputSmall: { borderWidth: 1, borderRadius: 8, padding: 8, width: '100%', textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  btnCancel: { flex: 1, padding: 15, backgroundColor: '#eee', borderRadius: 10, alignItems: 'center' },
  btnSave: { flex: 1, padding: 15, backgroundColor: '#007AFF', borderRadius: 10, alignItems: 'center' }
});