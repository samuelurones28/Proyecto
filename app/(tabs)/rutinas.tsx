import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform, Modal, SectionList, FlatList, Image, useColorScheme, Vibration, Dimensions, AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../supabase';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import * as Notifications from 'expo-notifications';
import { useWorkout } from '../../components/WorkoutContext';
import { useAuth } from '../../components/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RAPIDAPI_KEY } from '../../config';

// Configuración de notificaciones (esencial para iOS en primer plano)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
}); 

export default function RutinasScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const systemScheme = useColorScheme();
  const esOscuro = systemScheme === 'dark';
  const { user } = useAuth();

  const {
    rutinaActiva,
    tiempo,
    iniciarRutina,
    finalizarRutina,
    setRutinaActiva
  } = useWorkout();

  const [vistaEntrenoExpandida, setVistaEntrenoExpandida] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);

  useEffect(() => {
    if (params.expandir === 'true') {
        setVistaEntrenoExpandida(true);
        router.setParams({ expandir: '' });
    }
  }, [params.expandir]);

  const colores = {
    fondo: esOscuro ? '#000000' : '#f2f2f7',
    tarjeta: esOscuro ? '#1c1c1e' : '#ffffff',
    texto: esOscuro ? '#ffffff' : '#1c1c1e',
    subtexto: esOscuro ? '#8e8e93' : '#666',
    borde: esOscuro ? '#2c2c2e' : '#eee',
    inputBg: esOscuro ? '#2c2c2e' : '#f9f9f9',
    primario: '#007AFF',
    seccionHeader: esOscuro ? '#2c2c2e' : '#e5e5ea',
    chipInactivo: esOscuro ? '#2c2c2e' : '#e0e0e0',
    chipTextoInactivo: esOscuro ? '#aaa' : '#555',
    cronometro: esOscuro ? '#FFD60A' : '#E6B800'
  };

  const [cargando, setCargando] = useState(true);
  const [buscandoAPI, setBuscandoAPI] = useState(false);
  
  const [rutinaHoy, setRutinaHoy] = useState(null); 
  const [diaHoyNombre, setDiaHoyNombre] = useState("");
  const [planSemanal, setPlanSemanal] = useState({}); 
  const [misRutinas, setMisRutinas] = useState([]);

  const [modalInfoVisible, setModalInfoVisible] = useState(false);

  const [modalBibliotecaVisible, setModalBibliotecaVisible] = useState(false);
  const [catalogoLocal, setCatalogoLocal] = useState([]); 
  const [resultadosAPI, setResultadosAPI] = useState([]); 
  const [filtroTexto, setFiltroTexto] = useState(''); 
  const [filtroMusculo, setFiltroMusculo] = useState('Todos');
  
  const [nuevoEjercicioManual, setNuevoEjercicioManual] = useState(''); 
  const [mostrandoInputManual, setMostrandoInputManual] = useState(false); 

  const [modalNombreRutinaVisible, setModalNombreRutinaVisible] = useState(false);
  const [nombreNuevaRutina, setNombreNuevaRutina] = useState('');

  const [historialPrevio, setHistorialPrevio] = useState({}); 
  const [modalStatsVisible, setModalStatsVisible] = useState(false);
  const [statsEjercicio, setStatsEjercicio] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [datosGrafica, setDatosGrafica] = useState(null);

  // --- ESTADOS TEMPORIZADOR ---
  const [descansoActivo, setDescansoActivo] = useState(false);
  const [tiempoDescanso, setTiempoDescanso] = useState(60); 
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [modalDescansoVisible, setModalDescansoVisible] = useState(false);
  
  const descansoIntervalRef = useRef(null);
  const endTimeRef = useRef(null); 
  const notificationIdRef = useRef(null); 
  const appState = useRef(AppState.currentState);

  const musculosDisponibles = ["Todos", "Pecho", "Espalda", "Pierna", "Hombro", "Bíceps", "Tríceps", "Abdominales", "Cardio", "Otro"];

  useFocusEffect(useCallback(() => { cargarTodo(); }, [user]));
  
  useEffect(() => { 
      if (rutinaActiva && rutinaActiva.ejercicios) { cargarHistorialPrevio(rutinaActiva.ejercicios); } 
  }, [rutinaActiva?.id]);

  // --- GESTIÓN DE PERMISOS Y SEGUNDO PLANO ---
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
          Alert.alert('Permisos necesarios', 'Activa las notificaciones para avisarte cuando termine el descanso.');
      }
      
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    })();

    // Listener para actualizar tiempo al volver a la app (si estaba en segundo plano)
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App vuelve al primer plano: Recalcular tiempo restante
        if (descansoActivo && endTimeRef.current) {
            const now = Date.now();
            const left = Math.ceil((endTimeRef.current - now) / 1000);
            if (left <= 0) {
                finalizarDescanso(); // Ya terminó mientras estabas fuera
            } else {
                setSegundosRestantes(left); // Actualizar visualmente
            }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [descansoActivo]); // Dependencia necesaria para leer estado actualizado

  const ajustarTiempoConfig = (delta) => {
      setTiempoDescanso(prev => Math.max(15, prev + delta));
  };

  const modificarTiempoEnCurso = async (delta) => {
      if (!descansoActivo || !endTimeRef.current) return;
      
      // Cancelar notificación anterior
      if (notificationIdRef.current) {
          await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
          notificationIdRef.current = null;
      }

      endTimeRef.current += (delta * 1000);
      const now = Date.now();
      const leftSeconds = Math.ceil((endTimeRef.current - now) / 1000);

      if (leftSeconds <= 0) {
          finalizarDescanso();
      } else {
          setSegundosRestantes(leftSeconds);
          // Re-programar nueva notificación
          try {
            const newId = await Notifications.scheduleNotificationAsync({
                content: { title: "¡Tiempo!", body: "El descanso ha terminado. ¡A darle! 💪", sound: true },
                trigger: { 
                    seconds: leftSeconds > 0 ? leftSeconds : 1, 
                    repeats: false,
                    channelId: 'default'
                },
            });
            notificationIdRef.current = newId;
          } catch (e) { console.log("Error reprogramando:", e); }
      }
  };

  const iniciarDescanso = async (t = null) => {
    const tiempoFinal = t || tiempoDescanso;
    
    // Limpieza preventiva
    if (descansoIntervalRef.current) clearInterval(descansoIntervalRef.current);
    if (notificationIdRef.current) await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);

    setModalDescansoVisible(false);
    setSegundosRestantes(tiempoFinal);
    setDescansoActivo(true);
    setTiempoDescanso(tiempoFinal);

    endTimeRef.current = Date.now() + (tiempoFinal * 1000);

    // 1. PROGRAMAR NOTIFICACIÓN DEL SISTEMA (Para cuando estás fuera de la app)
    try {
        const id = await Notifications.scheduleNotificationAsync({
            content: { title: "¡Tiempo!", body: "El descanso ha terminado. ¡A darle! 💪", sound: true },
            trigger: { 
                seconds: tiempoFinal, 
                repeats: false,
                channelId: 'default'
            },
        });
        notificationIdRef.current = id;
    } catch (e) { console.log("Error programando inicio:", e); }

    // 2. INTERVALO VISUAL (Solo actualiza la UI cada segundo)
    descansoIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const left = Math.ceil((endTimeRef.current - now) / 1000);
      
      if (left <= 0) {
        // IMPORTANTE: Limpiar intervalo AQUÍ para evitar bucle infinito
        if (descansoIntervalRef.current) clearInterval(descansoIntervalRef.current);
        finalizarDescanso();
      } else {
        setSegundosRestantes(left);
      }
    }, 250); // Revisamos cada 250ms para mayor fluidez
  };

  const finalizarDescanso = async () => {
    // Asegurar limpieza total
    if (descansoIntervalRef.current) clearInterval(descansoIntervalRef.current);
    notificationIdRef.current = null; // La notificación ya sonó, olvidamos ID
    
    setSegundosRestantes(0);
    setDescansoActivo(false);
    
    // Vibración para avisar si la app está abierta
    Vibration.vibrate([0, 500, 200, 500]); 
  };

  const detenerDescanso = async () => {
    if (descansoIntervalRef.current) clearInterval(descansoIntervalRef.current);
    
    // Si paramos manualmente, cancelamos la notificación pendiente
    if (notificationIdRef.current) {
        await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
        notificationIdRef.current = null;
    }
    
    setDescansoActivo(false);
    setSegundosRestantes(0);
  };

  const formatearTiempo = (seg) => {
    if (seg < 0) seg = 0;
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- DATOS ---
  const cargarTodo = async () => {
    if (!user) return;
    setCargando(true);
    await Promise.all([cargarPlanIA(), cargarMisRutinas(), cargarCatalogoLocal()]);
    setCargando(false);
  };

  const cargarPlanIA = async () => {
    if (!user) return;
    const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const hoyIndex = new Date().getDay();
    const hoyNombre = diasSemana[hoyIndex];
    setDiaHoyNombre(hoyNombre.charAt(0).toUpperCase() + hoyNombre.slice(1));

    const { data } = await supabase.from('planes_semanales').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
    if (data && data[0]) {
        const plan = data[0].datos_semana || {};
        setPlanSemanal(plan);
        const keyHoy = Object.keys(plan).find(k => k.toLowerCase() === hoyNombre.toLowerCase());
        setRutinaHoy(keyHoy ? normalizarRutina(plan[keyHoy], hoyNombre) : null);
    }
  };

  const cargarMisRutinas = async () => {
      if (!user) return;
      const { data } = await supabase.from('rutinas_personalizadas').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setMisRutinas(data || []);
  };

  const cargarCatalogoLocal = async () => {
    const { data } = await supabase.from('catalogo_ejercicios').select('*').order('musculo', { ascending: true }).order('nombre', { ascending: true });
    if (data) setCatalogoLocal(data);
  };

  const buscarEnExerciseDB = async (texto) => {
    setFiltroTexto(texto);
    if (texto.length < 3) {
        setResultadosAPI([]); 
        return;
    }
    setBuscandoAPI(true);
    try {
        const response = await fetch(`https://exercisedb.p.rapidapi.com/exercises/name/${texto.toLowerCase()}?limit=15`, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
            }
        });
        const data = await response.json();
        if (Array.isArray(data)) setResultadosAPI(data); else setResultadosAPI([]);
    } catch (error) { console.error("Error API:", error); } finally { setBuscandoAPI(false); }
  };

  const seccionesCatalogoLocal = useMemo(() => {
    if (!catalogoLocal.length) return [];
    const filtrados = catalogoLocal.filter(e => {
        const coincideTexto = e.nombre.toLowerCase().includes(filtroTexto.toLowerCase());
        const coincideMusculo = filtroMusculo === 'Todos' || (e.musculo && e.musculo.toLowerCase() === filtroMusculo.toLowerCase());
        return coincideTexto && coincideMusculo;
    });
    const agrupados = filtrados.reduce((acc, item) => {
      const grupo = item.musculo || 'General';
      if (!acc[grupo]) acc[grupo] = [];
      acc[grupo].push(item);
      return acc;
    }, {});
    return Object.keys(agrupados).sort().map(key => ({ title: key, data: agrupados[key] }));
  }, [catalogoLocal, filtroTexto, filtroMusculo]);

  const normalizarRutina = (rutinaRaw, tituloDefecto) => {
    if (!rutinaRaw) return { titulo: tituloDefecto, ejercicios: [] };
    const tituloReal = rutinaRaw.titulo || rutinaRaw.nombre || tituloDefecto;
    const ejerciciosLimpios = rutinaRaw.ejercicios?.map(ej => {
        let nombreEj = "Ejercicio"; let seriesObj = 3; let repsObj = "8-12"; let tipObj = ""; let gifUrlObj = null;
        if (typeof ej === 'string') { nombreEj = ej; } 
        else if (typeof ej === 'object') {
            nombreEj = ej.nombre || ej.name || ej.titulo || "Ejercicio";
            seriesObj = parseInt(ej.series) || 3;
            repsObj = ej.reps || "8-12";
            tipObj = ej.tip || "";
            gifUrlObj = ej.gifUrl || null; 
        }
        return {
            nombre: nombreEj, tip: tipObj, gifUrl: gifUrlObj,
            metaInfo: { series: seriesObj.toString(), reps: repsObj.toString() }, 
            seriesDetalladas: ej.seriesDetalladas || Array.from({ length: seriesObj }, () => ({ kg: '', reps: '', completado: false }))
        };
    }) || [];
    return { id: rutinaRaw.id || null, titulo: tituloReal, ejercicios: ejerciciosLimpios };
  };

  const cargarHistorialPrevio = async (ejercicios) => {
    if (!ejercicios || ejercicios.length === 0 || !user) return;
    const nombres = ejercicios.map(e => e.nombre);
    const historialMap = {};
    for (const nombre of nombres) {
        const { data: ultFechas } = await supabase.from('historial_series').select('fecha').eq('user_id', user.id).eq('ejercicio', nombre).order('fecha', { ascending: false }).limit(1);
        if (ultFechas && ultFechas.length > 0) {
            const fechaUltima = ultFechas[0].fecha;
            const { data: seriesPrevias } = await supabase.from('historial_series').select('serie_index, kg, reps').eq('user_id', user.id).eq('ejercicio', nombre).eq('fecha', fechaUltima).order('serie_index', { ascending: true });
            if (seriesPrevias) historialMap[nombre] = seriesPrevias;
        }
    }
    setHistorialPrevio(historialMap);
  };

  const abrirEstadisticas = async (nombreEjercicio) => {
    if (!user) return;
    setModalStatsVisible(true); setLoadingStats(true); setStatsEjercicio({ nombre: nombreEjercicio, pr: 0, max1rm: 0 });
    try {
        const { data } = await supabase.from('historial_series').select('kg, reps, fecha').eq('user_id', user.id).eq('ejercicio', nombreEjercicio).order('fecha', { ascending: true });
        if (data && data.length > 0) {
            let maxPeso = 0; let max1RM = 0;
            const dataProcesada = data.map(item => {
                const rm = Math.round(item.kg * (1 + item.reps / 30));
                if (item.kg > maxPeso) maxPeso = item.kg;
                if (rm > max1RM) max1RM = rm;
                return { fecha: item.fecha, rm: rm };
            });
            const mapDia = {}; dataProcesada.forEach(d => { if(!mapDia[d.fecha] || d.rm > mapDia[d.fecha].rm) mapDia[d.fecha] = d; });
            const arrayGrafica = Object.values(mapDia).slice(-10);
            setStatsEjercicio({ nombre: nombreEjercicio, pr: maxPeso, max1rm: max1RM });
            if (arrayGrafica.length > 1) {
                setDatosGrafica({ labels: arrayGrafica.map(d => { const dt = new Date(d.fecha); return `${dt.getDate()}/${dt.getMonth()+1}`; }), datasets: [{ data: arrayGrafica.map(d => d.rm) }] });
            } else setDatosGrafica(null);
        } else setDatosGrafica(null);
    } catch (e) { console.error(e); } finally { setLoadingStats(false); }
  };

  const abrirRutina = (rutina, esPersonalizada, tituloOverride = null, soloEditar = false) => {
      if (!rutina || typeof rutina !== 'object') { Alert.alert("Descanso", "Día libre."); return; }

      const rutinaLimpia = normalizarRutina(rutina, tituloOverride || rutina.nombre);
      if (esPersonalizada) rutinaLimpia.id = rutina.id;
      rutinaLimpia.esPersonalizada = esPersonalizada;

      if (soloEditar) {
          // Modo edición: solo carga la rutina sin iniciar cronómetro
          setRutinaActiva(rutinaLimpia);
          setModoEdicion(true);
      } else {
          // Modo entrenamiento: inicia cronómetro
          iniciarRutina(rutinaLimpia);
          setModoEdicion(false);
      }

      setVistaEntrenoExpandida(true);
      cargarHistorialPrevio(rutinaLimpia.ejercicios);
  };

  const crearNuevaRutina = async () => {
      if (!nombreNuevaRutina.trim() || !user) return;
      const nueva = { user_id: user.id, nombre: nombreNuevaRutina, ejercicios: [] };
      const { data, error } = await supabase.from('rutinas_personalizadas').insert(nueva).select();
      if (!error && data) {
          setModalNombreRutinaVisible(false); setNombreNuevaRutina('');
          await cargarMisRutinas();
          abrirRutina(data[0], true, null, true); // Modo edición
      }
  };

  const guardarCambiosRutinaActiva = async () => {
      if (!rutinaActiva || !user) return;
      if (rutinaActiva.esPersonalizada && rutinaActiva.id) {
          const ejerciciosParaGuardar = rutinaActiva.ejercicios.map(e => ({ nombre: e.nombre, series: e.metaInfo?.series, reps: e.metaInfo?.reps, tip: e.tip, gifUrl: e.gifUrl }));
          await supabase.from('rutinas_personalizadas').update({ ejercicios: ejerciciosParaGuardar }).eq('id', rutinaActiva.id).eq('user_id', user.id);
          Alert.alert("Guardado", "Rutina actualizada."); cargarMisRutinas();
      } else { Alert.alert("Info", "Cambios temporales guardados en sesión."); }
  };

  const eliminarRutinaPersonalizada = async (id) => {
      Alert.alert("Eliminar", "¿Borrar?", [{ text: "Cancelar" }, { text: "Borrar", style: 'destructive', onPress: async () => { if (user) { await supabase.from('rutinas_personalizadas').delete().eq('id', id).eq('user_id', user.id); cargarMisRutinas(); } }}]);
  };

  const descartarRutina = () => {
    Alert.alert("¿Descartar rutina?", "Se perderán todos los datos de este entrenamiento.", [
        { text: "Cancelar" },
        { text: "Descartar", style: 'destructive', onPress: () => {
            finalizarRutina(() => {
                // No guardar nada, solo limpiar el estado
                setVistaEntrenoExpandida(false);
                setModoEdicion(false);
            });
        }}
    ]);
  };

  const finalizarEntreno = async () => {
    if (!user) return;
    Alert.alert("¿Terminar?", `Tiempo total: ${formatearTiempo(tiempo)}. Se guardarán tus series.`, [
        { text: "Seguir" },
        { text: "Finalizar", onPress: async () => {
            finalizarRutina(async (tiempoFinal, rutinaFinalizada) => {
                setCargando(true);
                try {
                    const hoyISO = new Date().toISOString().split('T')[0];
                    const seriesParaGuardar = [];
                    rutinaFinalizada.ejercicios.forEach(ej => {
                        ej.seriesDetalladas.forEach((serie, index) => {
                            if (serie.kg && serie.reps) seriesParaGuardar.push({ user_id: user.id, fecha: hoyISO, ejercicio: ej.nombre, serie_index: index + 1, kg: parseFloat(serie.kg), reps: parseFloat(serie.reps) });
                        });
                    });
                    if (seriesParaGuardar.length > 0) await supabase.from('historial_series').insert(seriesParaGuardar);
                    if (!rutinaFinalizada.esPersonalizada) await supabase.from('calendario_acciones').upsert({ user_id: user.id, fecha: hoyISO, estado: 'completado' });
                    Alert.alert("Hecho", "Entrenamiento registrado.");
                    setVistaEntrenoExpandida(false);
                } catch (e) { Alert.alert("Error", e.message); } finally { setCargando(false); }
            });
        }}
    ]);
  };

  const seleccionarDeBiblioteca = (ejercicio, esDeAPI = false) => {
    setModalBibliotecaVisible(false); setFiltroTexto(''); setMostrandoInputManual(false); setNuevoEjercicioManual(''); setFiltroMusculo('Todos'); setResultadosAPI([]);
    const nombre = esDeAPI ? ejercicio.name.charAt(0).toUpperCase() + ejercicio.name.slice(1) : ejercicio.nombre;
    const musculo = esDeAPI ? ejercicio.bodyPart : ejercicio.musculo;
    const gif = esDeAPI ? ejercicio.gifUrl : null;
    const nuevo = { nombre, tip: musculo ? `Músculo: ${musculo}` : "", gifUrl: gif, metaInfo: { series: "3", reps: "10-12" }, seriesDetalladas: [{ kg: '', reps: '', completado: false }, { kg: '', reps: '', completado: false }, { kg: '', reps: '', completado: false }] };
    
    const copia = { ...rutinaActiva }; 
    copia.ejercicios.push(nuevo); 
    setRutinaActiva(copia);

    if (rutinaActiva.esPersonalizada) guardarCambiosRutinaActiva();
  };

  const agregarEjercicioManual = () => {
      if (!nuevoEjercicioManual.trim()) return;
      seleccionarDeBiblioteca({ nombre: nuevoEjercicioManual, musculo: "Personalizado" }, false);
  };

  const actualizarSerie = (eIdx, sIdx, campo, val) => { 
      const c = { ...rutinaActiva }; 
      c.ejercicios = [...rutinaActiva.ejercicios];
      c.ejercicios[eIdx] = { ...c.ejercicios[eIdx] };
      c.ejercicios[eIdx].seriesDetalladas = [...c.ejercicios[eIdx].seriesDetalladas];
      c.ejercicios[eIdx].seriesDetalladas[sIdx] = { ...c.ejercicios[eIdx].seriesDetalladas[sIdx] };
      
      c.ejercicios[eIdx].seriesDetalladas[sIdx][campo] = val; 
      setRutinaActiva(c); 
  };

  const toggleCheck = (eIdx, sIdx) => {
      const c = { ...rutinaActiva };
      c.ejercicios = [...rutinaActiva.ejercicios];
      c.ejercicios[eIdx] = { ...c.ejercicios[eIdx] };
      c.ejercicios[eIdx].seriesDetalladas = [...c.ejercicios[eIdx].seriesDetalladas];
      c.ejercicios[eIdx].seriesDetalladas[sIdx] = { ...c.ejercicios[eIdx].seriesDetalladas[sIdx] };

      c.ejercicios[eIdx].seriesDetalladas[sIdx].completado = !c.ejercicios[eIdx].seriesDetalladas[sIdx].completado;
      setRutinaActiva(c);

      // Solo iniciar descanso en modo entrenamiento, no en modo edición
      if (!modoEdicion && c.ejercicios[eIdx].seriesDetalladas[sIdx].completado) {
          iniciarDescanso();
      }
  };

  const eliminarEjercicio = (idx) => { 
      const c = { ...rutinaActiva }; 
      c.ejercicios = [...c.ejercicios];
      c.ejercicios.splice(idx, 1); 
      setRutinaActiva(c); 
  };
  
  const agregarSerie = (idx) => { 
      const c = { ...rutinaActiva }; 
      c.ejercicios = [...c.ejercicios];
      c.ejercicios[idx] = { ...c.ejercicios[idx] };
      c.ejercicios[idx].seriesDetalladas = [...c.ejercicios[idx].seriesDetalladas];
      c.ejercicios[idx].seriesDetalladas.push({kg:'',reps:'',completado:false}); 
      setRutinaActiva(c); 
  };
  
  const quitarSerie = (idx) => { 
      const c = { ...rutinaActiva }; 
      c.ejercicios = [...c.ejercicios];
      c.ejercicios[idx] = { ...c.ejercicios[idx] };
      c.ejercicios[idx].seriesDetalladas = [...c.ejercicios[idx].seriesDetalladas];
      c.ejercicios[idx].seriesDetalladas.pop(); 
      setRutinaActiva(c); 
  };

  if (!rutinaActiva || !vistaEntrenoExpandida) {
    return (
        <SafeAreaView style={[styles.container, {backgroundColor: colores.fondo}]}>
            <View style={[styles.header, {backgroundColor: colores.tarjeta, borderColor: colores.borde}]}>
              <Text style={[styles.titulo, {color: colores.texto}]}>Mis Entrenamientos 🏋️</Text>
              
              {rutinaActiva && (
                  <TouchableOpacity onPress={() => setVistaEntrenoExpandida(true)} style={{backgroundColor: colores.primario, padding: 5, borderRadius: 5, marginRight: 10}}>
                      <Text style={{color:'white', fontWeight:'bold', fontSize: 12}}>Volver a Entreno</Text>
                  </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => setModalInfoVisible(true)}><Ionicons name="information-circle-outline" size={28} color={colores.primario} /></TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 150 }]}>
                
                {rutinaActiva && (
                    <View style={{backgroundColor: '#e3f2fd', padding: 10, borderRadius: 10, marginBottom: 20, flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
                        <Text style={{color: '#0d47a1'}}>⚠️ Hay un entrenamiento en curso.</Text>
                        <TouchableOpacity onPress={() => setVistaEntrenoExpandida(true)}><Text style={{fontWeight:'bold', color: colores.primario}}>VER</Text></TouchableOpacity>
                    </View>
                )}

                <Text style={[styles.seccionTitulo, {color: colores.texto}]}>Plan Inteligente</Text>
                {rutinaHoy ? (
                    <TouchableOpacity style={styles.cardHoy} onPress={() => abrirRutina(rutinaHoy, false, `Rutina de Hoy`)}>
                        <View style={styles.badgeHoy}><Text style={styles.txtBadge}>HOY</Text></View>
                        <Text style={styles.tituloCardHoy}>{rutinaHoy.titulo}</Text>
                        <Text style={styles.subtituloCard}>{rutinaHoy.ejercicios.length} Ejercicios • {diaHoyNombre}</Text>
                        <Ionicons name="play-circle" size={40} color="#007AFF" style={{position:'absolute', right:20, bottom:20}} />
                    </TouchableOpacity>
                ) : <View style={[styles.cardVacia, {backgroundColor: colores.tarjeta}]}><Text style={{color: colores.subtexto}}>Descanso programado.</Text></View>}

                <View style={[styles.listaSemana, {backgroundColor: colores.tarjeta}]}>
                    {Object.keys(planSemanal).filter(d => d.toLowerCase() !== diaHoyNombre.toLowerCase()).map((dia) => {
                            const rd = planSemanal[dia]; const off = !rd.ejercicios || rd.ejercicios.length === 0 || rd.titulo === "Descanso";
                            return (
                                <TouchableOpacity key={dia} style={[styles.itemSemana, {borderColor: colores.borde}]} onPress={() => abrirRutina(rd, false, rd.titulo || dia)}>
                                    <View><Text style={[styles.nombreRutinaLista, {color: off ? colores.subtexto : colores.texto}]}>{rd.titulo || "Rutina"}</Text><Text style={[styles.diaSemanaSmall, {color: colores.subtexto}]}>{dia}</Text></View>
                                    <View style={{flexDirection:'row', alignItems:'center'}}>{!off && <Text style={{marginRight:10, color: colores.primario, fontSize:12}}>{rd.ejercicios?.length} ej.</Text>}<Ionicons name="chevron-forward" size={16} color={colores.subtexto} /></View>
                                </TouchableOpacity>
                            );
                    })}
                </View>

                <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:30, marginBottom:10}}>
                    <Text style={[styles.seccionTitulo, {color: colores.texto}]}>Mis Rutinas</Text>
                    <TouchableOpacity onPress={() => setModalNombreRutinaVisible(true)}><Text style={{color: colores.primario, fontWeight:'bold'}}>+ Crear Nueva</Text></TouchableOpacity>
                </View>
                {misRutinas.map((rutina) => (
                    <View key={rutina.id} style={[styles.cardPersonalizada, {backgroundColor: colores.tarjeta}]}>
                        <View style={{flex:1}}>
                            <Text style={[styles.tituloPersonalizada, {color: colores.texto}]}>{rutina.nombre}</Text>
                            <Text style={[styles.subPersonalizada, {color: colores.subtexto}]}>{rutina.ejercicios?.length || 0} Ejercicios</Text>
                            <View style={{flexDirection:'row', gap:10, marginTop:10}}>
                                <TouchableOpacity onPress={() => abrirRutina(rutina, true, null, true)} style={{backgroundColor: colores.inputBg, paddingHorizontal:15, paddingVertical:8, borderRadius:8, flexDirection:'row', alignItems:'center', gap:5}}>
                                    <Ionicons name="create-outline" size={16} color={colores.texto} />
                                    <Text style={{color: colores.texto, fontWeight:'600', fontSize:13}}>Editar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => abrirRutina(rutina, true, null, false)} style={{backgroundColor: colores.primario, paddingHorizontal:15, paddingVertical:8, borderRadius:8, flexDirection:'row', alignItems:'center', gap:5}}>
                                    <Ionicons name="play" size={16} color="white" />
                                    <Text style={{color: 'white', fontWeight:'600', fontSize:13}}>Entrenar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => eliminarRutinaPersonalizada(rutina.id)} style={{padding:10}}><Ionicons name="trash-outline" size={20} color="#FF3B30" /></TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
            <Modal visible={modalNombreRutinaVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}><View style={[styles.modalContentSmall, {backgroundColor: colores.tarjeta}]}>
                    <Text style={[styles.modalTitle, {color: colores.texto}]}>Nombre Rutina</Text><TextInput style={[styles.inputNombre, {color: colores.texto, borderColor: colores.primario}]} placeholder="Ej: Espalda" placeholderTextColor={colores.subtexto} value={nombreNuevaRutina} onChangeText={setNombreNuevaRutina} autoFocus />
                    <View style={styles.modalBotones}><TouchableOpacity onPress={()=>setModalNombreRutinaVisible(false)} style={styles.btnCancel}><Text>Cancelar</Text></TouchableOpacity><TouchableOpacity onPress={crearNuevaRutina} style={styles.btnSave}><Text style={{color:'white'}}>Crear</Text></TouchableOpacity></View>
                </View></View>
            </Modal>
            <Modal visible={modalInfoVisible} transparent animationType="fade"><View style={styles.modalOverlay}><View style={[styles.modalContentSmall, {backgroundColor: colores.tarjeta}]}><Text style={[styles.modalTitle, {color: colores.texto}]}>Gestión de Rutinas</Text><Text style={{marginBottom:20, lineHeight:20, color: colores.subtexto}}>• Plan IA: Tu rutina asignada automáticamente.{"\n"}• Mis Rutinas: Crea y guarda tus propios entrenamientos.{"\n"}• Pulsa una rutina para iniciar el entrenamiento y registrar pesos.</Text><TouchableOpacity style={styles.btnControl} onPress={() => setModalInfoVisible(false)}><Text style={{fontWeight:'bold'}}>Cerrar</Text></TouchableOpacity></View></View></Modal>
        </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colores.fondo}]}>
        <View style={[styles.headerEntreno, {backgroundColor: colores.tarjeta, borderColor: colores.borde}]}>
            <TouchableOpacity onPress={() => {
                setVistaEntrenoExpandida(false);
            }}>
               <Ionicons name="chevron-down" size={30} color={colores.texto} />
            </TouchableOpacity>

            <View style={{alignItems: 'center'}}>
                <Text style={[styles.tituloEntreno, {color: colores.texto}]}>{rutinaActiva.titulo}</Text>
                {!modoEdicion && (
                    <Text style={{color: colores.cronometro, fontWeight: 'bold', fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'}}>
                        {formatearTiempo(tiempo)}
                    </Text>
                )}
                {modoEdicion && (
                    <Text style={{color: colores.subtexto, fontSize: 12}}>Modo Edición</Text>
                )}
            </View>

            {rutinaActiva.esPersonalizada ? (
                <TouchableOpacity onPress={guardarCambiosRutinaActiva}><Ionicons name="save-outline" size={24} color={colores.primario} /></TouchableOpacity>
            ) : <View style={{width: 24}} />}
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 150 }]}>
            {rutinaActiva.ejercicios.map((ej, i) => (
                <View key={i} style={[styles.cardEjercicio, {backgroundColor: colores.tarjeta}]}>
                      <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:8}}>
                        <View style={{flex:1, flexDirection:'row', alignItems:'center'}}>
                            {ej.gifUrl && <Image source={{uri: ej.gifUrl}} style={{width: 40, height: 40, borderRadius: 8, marginRight: 10, backgroundColor: '#eee'}} />}
                            <TouchableOpacity onPress={() => abrirEstadisticas(ej.nombre)} style={{flexDirection:'row', alignItems:'center', flex:1}}>
                                <Text style={[styles.nombreEjercicio, {flex:1}]}>{ej.nombre}</Text>
                                <Ionicons name="stats-chart" size={18} color={colores.primario} style={{marginLeft:8}} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={()=>eliminarEjercicio(i)}><Ionicons name="close" size={22} color={colores.subtexto}/></TouchableOpacity>
                      </View>
                      
                      <View style={styles.metaContainer}><Text style={styles.metaText}>🎯 Meta: {ej.metaInfo?.series}x{ej.metaInfo?.reps}</Text></View>
                      {ej.tip ? <Text style={styles.tipText}>💡 {ej.tip}</Text> : null}

                      <View style={[styles.rowHeader, {borderColor: colores.borde}]}>
                          <Text style={[styles.colHead, {width:40}]}>#</Text>
                          <Text style={[styles.colHead, {flex:1.5}]}>ANT</Text>
                          <Text style={[styles.colHead, {flex:1}]}>KG</Text>
                          <Text style={[styles.colHead, {flex:1}]}>REPS</Text>
                          <Text style={[styles.colHead, {width:40}]}>✅</Text>
                      </View>
                      
                      {ej.seriesDetalladas.map((serie, sIdx) => {
                          const datosPrevios = historialPrevio[ej.nombre]?.find(s => s.serie_index === sIdx + 1);
                          const textoPrevio = datosPrevios ? `${datosPrevios.kg}x${datosPrevios.reps}` : '-';
                          return (
                             <View key={sIdx} style={[styles.filaSerie, serie.completado && {opacity:0.5}]}>
                                 <Text style={[styles.numSerie, {color: colores.texto}]}>{sIdx+1}</Text>
                                 <Text style={[styles.txtAnterior, {backgroundColor: colores.inputBg, color: colores.subtexto}]}>{textoPrevio}</Text>
                                 <TextInput style={[styles.inputSerie, {backgroundColor: colores.inputBg, color: colores.texto, borderColor: colores.borde}]} placeholder={datosPrevios?.kg?.toString() || "-"} placeholderTextColor={colores.subtexto} value={serie.kg} onChangeText={v=>actualizarSerie(i, sIdx, 'kg', v)} keyboardType="numeric"/>
                                 <TextInput style={[styles.inputSerie, {backgroundColor: colores.inputBg, color: colores.texto, borderColor: colores.borde}]} placeholder={datosPrevios?.reps?.toString() || "-"} placeholderTextColor={colores.subtexto} value={serie.reps} onChangeText={v=>actualizarSerie(i, sIdx, 'reps', v)} keyboardType="numeric"/>
                                 <TouchableOpacity onPress={()=>toggleCheck(i,sIdx)}><Ionicons name={serie.completado?"checkmark-circle":"ellipse-outline"} size={32} color={serie.completado?"#34C759":colores.borde}/></TouchableOpacity>
                             </View>
                          );
                      })}

                      <View style={{flexDirection:'row', justifyContent:'center', marginTop:15, gap:20}}>
                          <TouchableOpacity onPress={()=>quitarSerie(i)} style={styles.btnControl}><Ionicons name="remove" size={20} color="#555"/></TouchableOpacity>
                          <TouchableOpacity onPress={()=>agregarSerie(i)} style={styles.btnControl}><Ionicons name="add" size={20} color="#555"/></TouchableOpacity>
                      </View>
                </View>
            ))}

            <TouchableOpacity style={styles.btnBiblioteca} onPress={() => setModalBibliotecaVisible(true)}><Ionicons name="add-circle" size={24} color="white" /><Text style={{color:'white', fontWeight:'bold'}}>Añadir Ejercicio</Text></TouchableOpacity>

            {modoEdicion ? (
                <TouchableOpacity style={[styles.btnTerminar, {backgroundColor: colores.primario}]} onPress={() => {
                    guardarCambiosRutinaActiva();
                    setVistaEntrenoExpandida(false);
                    setModoEdicion(false);
                }}>
                    <Text style={styles.txtTerminar}>GUARDAR Y CERRAR</Text>
                </TouchableOpacity>
            ) : (
                <>
                    <TouchableOpacity style={styles.btnTerminar} onPress={finalizarEntreno}>
                        <Text style={styles.txtTerminar}>TERMINAR RUTINA</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnDescartar, {backgroundColor: colores.tarjeta, borderWidth: 2, borderColor: '#FF3B30'}]} onPress={descartarRutina}>
                        <Ionicons name="close-circle-outline" size={24} color="#FF3B30" />
                        <Text style={[styles.txtTerminar, {color: '#FF3B30'}]}>DESCARTAR RUTINA</Text>
                    </TouchableOpacity>
                </>
            )}

            <View style={{height: 100}} />
        </ScrollView>

        {!modoEdicion && (
            descansoActivo ? (
                <View style={styles.floatingTimerContainer}>
                    <TouchableOpacity style={styles.timerControlBtn} onPress={() => modificarTiempoEnCurso(-15)}>
                        <Text style={{color:'white', fontWeight:'bold'}}>-15</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.timerMainBtn} onPress={detenerDescanso}>
                        <Text style={{color:'white', fontWeight:'bold', fontSize:18}}>{formatearTiempo(segundosRestantes)}</Text>
                        <Text style={{color:'rgba(255,255,255,0.8)', fontSize:10}}>PARAR</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.timerControlBtn} onPress={() => modificarTiempoEnCurso(15)}>
                        <Text style={{color:'white', fontWeight:'bold'}}>+15</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={styles.floatingTimer} onPress={() => setModalDescansoVisible(true)}>
                    <Ionicons name="timer-outline" size={28} color="white" />
                </TouchableOpacity>
            )
        )}

        <Modal visible={modalDescansoVisible} transparent animationType="fade">
            <TouchableOpacity style={styles.modalOverlay} onPress={() => setModalDescansoVisible(false)} activeOpacity={1}>
                <View style={[styles.modalContentSmall, {backgroundColor: colores.tarjeta}]}>
                    <Text style={[styles.modalTitle, {color: colores.texto}]}>⏱️ Tiempo de Descanso</Text>
                    
                    <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center', gap: 20, marginBottom: 25}}>
                        <TouchableOpacity onPress={() => ajustarTiempoConfig(-15)} style={[styles.btnControlTime, {backgroundColor: colores.inputBg}]}>
                            <Ionicons name="remove" size={28} color={colores.texto}/>
                        </TouchableOpacity>
                        <Text style={{fontSize: 32, fontWeight:'bold', color: colores.primario, fontVariant: ['tabular-nums']}}>
                            {formatearTiempo(tiempoDescanso)}
                        </Text>
                        <TouchableOpacity onPress={() => ajustarTiempoConfig(15)} style={[styles.btnControlTime, {backgroundColor: colores.inputBg}]}>
                            <Ionicons name="add" size={28} color={colores.texto}/>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={[styles.btnSaveMain, {backgroundColor: colores.primario, width:'100%', marginBottom:10}]} onPress={() => iniciarDescanso()}>
                        <Text style={{color:'white', fontWeight:'bold', fontSize:16}}>INICIAR</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={[styles.btnCancelMain, {backgroundColor: esOscuro ? '#333' : '#eee', width:'100%'}]} onPress={() => setModalDescansoVisible(false)}>
                        <Text style={{color: colores.texto, fontWeight:'600'}}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>

        <Modal visible={modalStatsVisible} animationType="slide" presentationStyle="pageSheet"><View style={[styles.modalContainer, {backgroundColor: colores.fondo}]}><View style={[styles.header, {backgroundColor: colores.tarjeta}]}><Text style={[styles.titulo, {color: colores.texto}]}>Progreso: {statsEjercicio?.nombre}</Text><TouchableOpacity onPress={()=>setModalStatsVisible(false)}><Ionicons name="close-circle" size={30} color={colores.texto}/></TouchableOpacity></View>{loadingStats ? <ActivityIndicator size="large" color={colores.primario}/> : (<View style={{padding:20}}><View style={{flexDirection:'row', gap:10, marginBottom:20}}><View style={[styles.statBox, {backgroundColor: colores.tarjeta}]}><Text style={styles.statLabel}>PR Histórico</Text><Text style={[styles.statVal, {color: colores.texto}]}>{statsEjercicio?.pr}kg</Text></View><View style={[styles.statBox, {backgroundColor: colores.tarjeta}]}><Text style={styles.statLabel}>1RM Est.</Text><Text style={[styles.statVal, {color: colores.texto}]}>{statsEjercicio?.max1rm}kg</Text></View></View>{datosGrafica ? <LineChart data={datosGrafica} width={Dimensions.get("window").width-40} height={220} chartConfig={{backgroundGradientFrom: colores.tarjeta, backgroundGradientTo: colores.tarjeta, color:(opacity)=>`rgba(0,122,255,${opacity})`, labelColor:()=>colores.subtexto}} bezier style={{borderRadius:16}}/> : <Text style={{textAlign:'center', color: colores.subtexto}}>No hay suficientes datos para gráfica.</Text>}</View>)}</View></Modal>

        <Modal visible={modalBibliotecaVisible} animationType="slide">
            <SafeAreaView style={[styles.modalContainer, {backgroundColor: colores.fondo}]}>
                <View style={[styles.header, {backgroundColor: colores.tarjeta}]}>
                    <Text style={[styles.titulo, {color: colores.texto}]}>Biblioteca</Text>
                    <TouchableOpacity onPress={()=>setModalBibliotecaVisible(false)}><Ionicons name="close" size={28} color={colores.texto}/></TouchableOpacity>
                </View>
                
                <View style={{backgroundColor: colores.tarjeta}}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{padding: 10, gap: 10}}>
                        {musculosDisponibles.map((m) => (
                            <TouchableOpacity key={m} style={[styles.chip, {backgroundColor: filtroMusculo === m ? colores.primario : colores.chipInactivo}]} onPress={() => setFiltroMusculo(m)}>
                                <Text style={{color: filtroMusculo === m ? 'white' : colores.chipTextoInactivo, fontWeight: 'bold'}}>{m}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={[styles.searchBar, {backgroundColor: colores.tarjeta}]}>
                    <Ionicons name="search" color={colores.subtexto}/>
                    <TextInput 
                        style={{flex:1, color: colores.texto, marginLeft: 5}} 
                        placeholder="Buscar ejercicio..." 
                        placeholderTextColor={colores.subtexto} 
                        value={filtroTexto} 
                        onChangeText={buscarEnExerciseDB} 
                    />
                    {buscandoAPI && <ActivityIndicator size="small" color={colores.primario}/>}
                </View>

                {!mostrandoInputManual && filtroTexto.length > 0 && resultadosAPI.length === 0 && (
                    <TouchableOpacity style={{flexDirection:'row', alignItems:'center', justifyContent:'center', padding:15, marginBottom:5, backgroundColor: colores.tarjeta, marginHorizontal:15, borderRadius:8}} onPress={agregarEjercicioManual}>
                        <Ionicons name="add-circle-outline" size={24} color={colores.primario} style={{marginRight:5}}/>
                        <Text style={{color: colores.primario, fontWeight:'bold', fontSize: 16}}>➕ Añadir "{filtroTexto}" como nuevo</Text>
                    </TouchableOpacity>
                )}

                {mostrandoInputManual && (
                    <View style={{marginHorizontal:15, marginBottom:15, padding:15, backgroundColor: colores.tarjeta, borderRadius:10}}>
                        <Text style={{color: colores.texto, fontWeight:'bold', marginBottom:10}}>Nombre del nuevo ejercicio:</Text>
                        <TextInput style={[styles.inputSerie, {height:40, textAlign:'left', paddingLeft:10, backgroundColor: colores.inputBg, color: colores.texto, borderColor: colores.borde, borderWidth:1}]} placeholder="Ej: Remo Pendlay" placeholderTextColor={colores.subtexto} value={nuevoEjercicioManual} onChangeText={setNuevoEjercicioManual} autoFocus/>
                        <View style={{flexDirection:'row', marginTop:10, gap:10}}>
                            <TouchableOpacity style={[styles.btnCancel, {flex:1}]} onPress={() => setMostrandoInputManual(false)}><Text style={{color:'#666'}}>Cancelar</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.btnSave, {flex:1}]} onPress={agregarEjercicioManual}><Text style={{color:'white'}}>Añadir</Text></TouchableOpacity>
                        </View>
                    </View>
                )}

                {resultadosAPI.length > 0 ? (
                    <FlatList
                        data={resultadosAPI}
                        keyExtractor={(item) => item.id}
                        initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5} removeClippedSubviews={true}
                        contentContainerStyle={{paddingBottom: 50}}
                        renderItem={({item}) => (
                            <TouchableOpacity style={[styles.itemCatalogo, {backgroundColor: colores.tarjeta}]} onPress={()=>seleccionarDeBiblioteca(item, true)}>
                                <View style={{flexDirection:'row', alignItems:'center', flex:1}}>
                                    <Image source={{uri: item.gifUrl}} style={{width: 50, height: 50, borderRadius: 5, marginRight: 10, backgroundColor: '#eee'}} />
                                    <View style={{flex:1}}>
                                        <Text style={{fontWeight:'bold', color: colores.texto, textTransform:'capitalize'}}>{item.name}</Text>
                                        <Text style={{color: colores.subtexto, fontSize: 12, textTransform:'capitalize'}}>{item.bodyPart} | {item.target}</Text>
                                    </View>
                                </View>
                                <Ionicons name="add-circle" size={24} color={colores.primario}/>
                            </TouchableOpacity>
                        )}
                    />
                ) : (
                    <SectionList
                        sections={seccionesCatalogoLocal}
                        keyExtractor={(item) => item.id.toString()}
                        initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5} removeClippedSubviews={true}
                        contentContainerStyle={{paddingBottom: 50}}
                        renderItem={({item}) => (
                            <TouchableOpacity style={[styles.itemCatalogo, {backgroundColor: colores.tarjeta}]} onPress={()=>seleccionarDeBiblioteca(item, false)}>
                                <Text style={{fontWeight:'bold', color: colores.texto}}>{item.nombre}</Text>
                                <Ionicons name="add-circle" size={24} color={colores.primario}/>
                            </TouchableOpacity>
                        )}
                        renderSectionHeader={({section: {title}}) => (
                            <View style={{backgroundColor: colores.seccionHeader, padding: 8, paddingLeft: 15}}>
                                <Text style={{fontWeight: 'bold', color: colores.texto, textTransform:'uppercase', fontSize: 12}}>{title}</Text>
                            </View>
                        )}
                        stickySectionHeadersEnabled={true}
                    />
                )}
            </SafeAreaView>
        </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: { padding: 20, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 22, fontWeight: 'bold' },
  scroll: { padding: 15 },
  seccionTitulo: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10, marginTop: 10 },
  cardHoy: { backgroundColor: '#007AFF', borderRadius: 20, padding: 20, height: 140, justifyContent: 'center', shadowColor:'#007AFF', shadowOpacity:0.3, elevation:5, marginBottom: 20 },
  badgeHoy: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal:8, paddingVertical:4, borderRadius:8, alignSelf:'flex-start', marginBottom:10 },
  txtBadge: { color:'white', fontWeight:'bold', fontSize:12 },
  tituloCardHoy: { color:'white', fontSize: 24, fontWeight:'bold' },
  subtituloCard: { color:'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 5 },
  cardVacia: { padding: 20, alignItems: 'center', backgroundColor: 'white', borderRadius: 10, marginBottom: 20 },
  listaSemana: { backgroundColor: 'white', borderRadius: 15, padding: 5 },
  itemSemana: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#f0f0f0', alignItems:'center' },
  nombreRutinaLista: { fontWeight: 'bold', fontSize: 16, color:'#333' },
  diaSemanaSmall: { color: '#888', fontSize: 12, textTransform: 'capitalize' },
  cardPersonalizada: { backgroundColor: 'white', borderRadius: 15, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, shadowColor:'#000', shadowOpacity:0.05 },
  tituloPersonalizada: { fontWeight: 'bold', fontSize: 16 },
  subPersonalizada: { color: '#888', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContentSmall: { width: '80%', padding: 20, borderRadius: 15, alignItems: 'center' },
  modalTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 15, textAlign: 'center' },
  inputNombre: { borderBottomWidth: 1, borderColor: '#007AFF', fontSize: 18, padding: 5, marginBottom: 20, textAlign: 'center', width:'100%' },
  modalBotones: { flexDirection: 'row', gap: 10 },
  btnCancel: { flex: 1, padding: 10, backgroundColor: '#eee', borderRadius: 8, alignItems: 'center' },
  btnSave: { flex: 1, padding: 10, backgroundColor: '#007AFF', borderRadius: 8, alignItems: 'center' },
  headerEntreno: { padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth:1 },
  tituloEntreno: { fontSize: 18, fontWeight: 'bold', textAlign:'center' },
  cardEjercicio: { borderRadius: 15, padding: 15, marginBottom: 15 },
  nombreEjercicio: { fontWeight: 'bold', fontSize: 18, color: '#007AFF' },
  metaContainer: { backgroundColor: '#fff9c4', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, marginBottom: 5 },
  metaText: { color: '#fbc02d', fontWeight: 'bold', fontSize: 12 },
  tipText: { color: '#666', fontStyle: 'italic', fontSize: 12, marginBottom: 10 },
  rowHeader: { flexDirection: 'row', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1 },
  colHead: { color: '#8e8e93', fontSize: 11, fontWeight:'700', textAlign: 'center', textTransform:'uppercase' },
  filaSerie: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8, height: 45 },
  numSerie: { width: 40, fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  txtAnterior: { flex: 1.5, fontSize: 14, textAlign: 'center', paddingVertical:10, borderRadius:8, overflow:'hidden' },
  inputSerie: { borderRadius: 8, padding: 0, flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', height:'100%' },
  btnControl: { backgroundColor: '#f0f0f0', width: 40, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnBiblioteca: { flexDirection:'row', backgroundColor:'#666', padding:15, borderRadius:15, justifyContent:'center', alignItems:'center', gap:10, marginBottom:10 },
  btnTerminar: { backgroundColor: '#34C759', padding: 18, borderRadius: 15, alignItems: 'center', shadowColor: '#34C759', shadowOpacity: 0.3, elevation: 5 },
  btnDescartar: { padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  txtTerminar: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  modalContainer: { flex: 1 },
  searchBar: { flexDirection: 'row', margin: 15, padding: 10, borderRadius: 10, alignItems: 'center', gap: 10 },
  itemCatalogo: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, marginHorizontal:15, marginBottom:10, borderRadius:10 },
  statBox: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center', shadowColor:'#000', shadowOpacity:0.05 },
  statLabel: { fontSize: 12, color: '#666', textTransform: 'uppercase' },
  statVal: { fontSize: 22, fontWeight: 'bold' },
  chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 5 },
  chipInactivo: { backgroundColor: '#e0e0e0' },
  
  floatingTimer: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  floatingTimerContainer: { position: 'absolute', bottom: 30, right: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3B30', borderRadius: 30, padding: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  timerMainBtn: { width: 80, alignItems: 'center', justifyContent: 'center' },
  timerControlBtn: { width: 40, height: 40, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btnControlTime: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  btnSaveMain: { padding: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnCancelMain: { padding: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }
});