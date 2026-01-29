import { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
  ActivityIndicator,
  useColorScheme
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface DatosUsuario {
  nombre: string;
  edad: string;
  altura: string;
  peso: string;
  objetivo: string;
  nivel_actividad: string;
  dias_no_disponibles: string;
}

export default function OnboardingScreen() {
  const systemScheme = useColorScheme();
  const esOscuro = systemScheme === 'dark';
  const scrollRef = useRef<ScrollView>(null);
  const [pasoActual, setPasoActual] = useState(0);
  const [guardando, setGuardando] = useState(false);

  const [datos, setDatos] = useState<DatosUsuario>({
    nombre: '',
    edad: '',
    altura: '',
    peso: '',
    objetivo: '',
    nivel_actividad: '',
    dias_no_disponibles: ''
  });

  const colores = {
    fondo: esOscuro ? '#000000' : '#f2f2f7',
    tarjeta: esOscuro ? '#1c1c1e' : '#ffffff',
    texto: esOscuro ? '#ffffff' : '#1c1c1e',
    subtexto: esOscuro ? '#8e8e93' : '#8e8e93',
    borde: esOscuro ? '#2c2c2e' : '#e5e5ea',
    inputBg: esOscuro ? '#2c2c2e' : '#f2f2f7',
    primario: '#007AFF',
    danger: '#FF3B30',
    success: '#34C759'
  };

  const pasos = [
    { titulo: 'Bienvenido', subtitulo: 'Vamos a conocerte mejor' },
    { titulo: 'Datos Personales', subtitulo: 'Tu nombre y edad' },
    { titulo: 'Medidas', subtitulo: 'Altura y peso actual' },
    { titulo: 'Tu Objetivo', subtitulo: 'Que quieres lograr' },
    { titulo: 'Nivel de Actividad', subtitulo: 'Tu rutina actual' },
    { titulo: 'Disponibilidad', subtitulo: 'Dias que NO puedes entrenar' }
  ];

  const scrollToPaso = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setPasoActual(index);
  };

  const siguiente = () => {
    if (pasoActual < pasos.length - 1) {
      scrollToPaso(pasoActual + 1);
    } else {
      guardarPerfil();
    }
  };

  const anterior = () => {
    if (pasoActual > 0) {
      scrollToPaso(pasoActual - 1);
    }
  };

  const validarPasoActual = (): boolean => {
    switch (pasoActual) {
      case 0: return true;
      case 1: return datos.nombre.trim().length > 0 && datos.edad.trim().length > 0;
      case 2: return datos.altura.trim().length > 0 && datos.peso.trim().length > 0;
      case 3: return datos.objetivo.length > 0;
      case 4: return datos.nivel_actividad.length > 0;
      case 5: return true;
      default: return true;
    }
  };

  const toggleDiaNoDisponible = (dia: string) => {
    let dias = datos.dias_no_disponibles ? datos.dias_no_disponibles.split(',').filter(d => d) : [];
    if (dias.includes(dia)) {
      dias = dias.filter(d => d !== dia);
    } else {
      dias.push(dia);
    }
    setDatos({ ...datos, dias_no_disponibles: dias.join(',') });
  };

  const guardarPerfil = async () => {
    if (!validarPasoActual()) {
      Alert.alert('Campos incompletos', 'Por favor completa todos los campos requeridos.');
      return;
    }

    setGuardando(true);
    try {
      // Verificar si ya existe un perfil
      const { data: existente } = await supabase.from('perfil').select('id').limit(1);

      const perfilData = {
        nombre: datos.nombre.trim(),
        edad: parseInt(datos.edad) || null,
        altura: parseInt(datos.altura) || null,
        objetivo: datos.objetivo,
        nivel_actividad: datos.nivel_actividad,
        dias_no_disponibles: datos.dias_no_disponibles,
        onboarding_completado: true,
        tema: 'system'
      };

      if (existente && existente.length > 0) {
        // Actualizar perfil existente
        const { error } = await supabase
          .from('perfil')
          .update(perfilData)
          .eq('id', existente[0].id);
        if (error) throw error;
      } else {
        // Crear nuevo perfil
        const { error } = await supabase
          .from('perfil')
          .insert([perfilData]);
        if (error) throw error;
      }

      // Guardar peso inicial en mediciones
      if (datos.peso) {
        await supabase.from('mediciones').insert([{
          peso: parseFloat(datos.peso),
          fecha: new Date().toISOString().split('T')[0]
        }]);
      }

      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo guardar el perfil');
    } finally {
      setGuardando(false);
    }
  };

  const BotonOpcion = ({
    seleccionado,
    label,
    icono,
    descripcion,
    onPress
  }: {
    seleccionado: boolean;
    label: string;
    icono: string;
    descripcion: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[
        styles.btnOpcion,
        {
          backgroundColor: colores.tarjeta,
          borderColor: seleccionado ? colores.primario : colores.borde,
          ...(seleccionado && { backgroundColor: esOscuro ? '#0A84FF20' : '#EBF5FF' })
        }
      ]}
      onPress={onPress}
    >
      <View style={styles.btnOpcionRow}>
        <Text style={{ fontSize: 28 }}>{icono}</Text>
        <View style={styles.btnOpcionTextos}>
          <Text style={[styles.btnOpcionLabel, { color: seleccionado ? colores.primario : colores.texto }]}>
            {label}
          </Text>
          <Text style={[styles.btnOpcionDesc, { color: colores.subtexto }]}>{descripcion}</Text>
        </View>
        {seleccionado && (
          <Ionicons name="checkmark-circle" size={24} color={colores.primario} />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderPaso = (index: number) => {
    switch (index) {
      case 0:
        return (
          <View style={styles.pasoContent}>
            <Text style={{ fontSize: 80, textAlign: 'center', marginBottom: 20 }}>💪</Text>
            <Text style={[styles.pasoTitulo, { color: colores.texto }]}>
              Bienvenido a AI Fitness Coach
            </Text>
            <Text style={[styles.pasoSubtitulo, { color: colores.subtexto }]}>
              Tu entrenador personal con inteligencia artificial. Vamos a configurar tu perfil para personalizar tu experiencia.
            </Text>
          </View>
        );

      case 1:
        return (
          <View style={styles.pasoContent}>
            <Text style={{ fontSize: 60, textAlign: 'center', marginBottom: 20 }}>👋</Text>
            <Text style={[styles.inputLabel, { color: colores.texto }]}>Como te llamas?</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colores.inputBg, color: colores.texto, borderColor: colores.borde }]}
              placeholder="Tu nombre"
              placeholderTextColor={colores.subtexto}
              value={datos.nombre}
              onChangeText={(t) => setDatos({ ...datos, nombre: t })}
              autoFocus
            />
            <Text style={[styles.inputLabel, { color: colores.texto, marginTop: 20 }]}>Cuantos años tienes?</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colores.inputBg, color: colores.texto, borderColor: colores.borde }]}
              placeholder="Tu edad"
              placeholderTextColor={colores.subtexto}
              value={datos.edad}
              onChangeText={(t) => setDatos({ ...datos, edad: t })}
              keyboardType="numeric"
            />
          </View>
        );

      case 2:
        return (
          <View style={styles.pasoContent}>
            <Text style={{ fontSize: 60, textAlign: 'center', marginBottom: 20 }}>📏</Text>
            <Text style={[styles.inputLabel, { color: colores.texto }]}>Cual es tu altura? (cm)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colores.inputBg, color: colores.texto, borderColor: colores.borde }]}
              placeholder="Ej: 175"
              placeholderTextColor={colores.subtexto}
              value={datos.altura}
              onChangeText={(t) => setDatos({ ...datos, altura: t })}
              keyboardType="numeric"
            />
            <Text style={[styles.inputLabel, { color: colores.texto, marginTop: 20 }]}>Cual es tu peso actual? (kg)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colores.inputBg, color: colores.texto, borderColor: colores.borde }]}
              placeholder="Ej: 70"
              placeholderTextColor={colores.subtexto}
              value={datos.peso}
              onChangeText={(t) => setDatos({ ...datos, peso: t })}
              keyboardType="numeric"
            />
          </View>
        );

      case 3:
        return (
          <View style={styles.pasoContent}>
            <Text style={{ fontSize: 60, textAlign: 'center', marginBottom: 20 }}>🎯</Text>
            <Text style={[styles.pasoTitulo, { color: colores.texto, fontSize: 20, marginBottom: 20 }]}>
              Cual es tu objetivo principal?
            </Text>
            <BotonOpcion
              seleccionado={datos.objetivo === 'definicion'}
              label="Definicion"
              icono="🔥"
              descripcion="Perder grasa y marcar musculo"
              onPress={() => setDatos({ ...datos, objetivo: 'definicion' })}
            />
            <BotonOpcion
              seleccionado={datos.objetivo === 'recomposicion'}
              label="Recomposicion"
              icono="⚖️"
              descripcion="Ganar musculo y perder grasa"
              onPress={() => setDatos({ ...datos, objetivo: 'recomposicion' })}
            />
            <BotonOpcion
              seleccionado={datos.objetivo === 'volumen'}
              label="Volumen"
              icono="🦍"
              descripcion="Ganar masa muscular"
              onPress={() => setDatos({ ...datos, objetivo: 'volumen' })}
            />
          </View>
        );

      case 4:
        return (
          <View style={styles.pasoContent}>
            <Text style={{ fontSize: 60, textAlign: 'center', marginBottom: 20 }}>⚡</Text>
            <Text style={[styles.pasoTitulo, { color: colores.texto, fontSize: 20, marginBottom: 20 }]}>
              Cual es tu nivel de actividad?
            </Text>
            <BotonOpcion
              seleccionado={datos.nivel_actividad === 'moderado'}
              label="Moderado"
              icono="🏃"
              descripcion="Entreno 3-5 dias por semana"
              onPress={() => setDatos({ ...datos, nivel_actividad: 'moderado' })}
            />
            <BotonOpcion
              seleccionado={datos.nivel_actividad === 'activo'}
              label="Activo"
              icono="🏋️"
              descripcion="Entreno 6-7 dias por semana"
              onPress={() => setDatos({ ...datos, nivel_actividad: 'activo' })}
            />
            <BotonOpcion
              seleccionado={datos.nivel_actividad === 'muy_activo'}
              label="Muy Activo"
              icono="🚀"
              descripcion="Atleta o profesional del fitness"
              onPress={() => setDatos({ ...datos, nivel_actividad: 'muy_activo' })}
            />
          </View>
        );

      case 5:
        return (
          <View style={styles.pasoContent}>
            <Text style={{ fontSize: 60, textAlign: 'center', marginBottom: 20 }}>📅</Text>
            <Text style={[styles.pasoTitulo, { color: colores.texto, fontSize: 20, marginBottom: 10 }]}>
              Dias que NO puedes entrenar
            </Text>
            <Text style={[styles.pasoSubtitulo, { color: colores.subtexto, marginBottom: 20 }]}>
              Selecciona los dias que tienes compromisos fijos (trabajo, familia, etc.)
            </Text>
            <View style={styles.gridDias}>
              {[
                { id: 'lunes', label: 'LU' },
                { id: 'martes', label: 'MA' },
                { id: 'miercoles', label: 'MI' },
                { id: 'jueves', label: 'JU' },
                { id: 'viernes', label: 'VI' },
                { id: 'sabado', label: 'SA' },
                { id: 'domingo', label: 'DO' }
              ].map((dia) => {
                const seleccionado = datos.dias_no_disponibles.includes(dia.id);
                return (
                  <TouchableOpacity
                    key={dia.id}
                    style={[
                      styles.diaCirculo,
                      {
                        borderColor: seleccionado ? colores.danger : colores.borde,
                        backgroundColor: seleccionado ? colores.danger : colores.tarjeta
                      }
                    ]}
                    onPress={() => toggleDiaNoDisponible(dia.id)}
                  >
                    <Text style={[
                      styles.diaTexto,
                      { color: seleccionado ? '#fff' : colores.texto }
                    ]}>
                      {dia.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.infoText, { color: colores.subtexto }]}>
              Puedes dejarlo vacio si tienes disponibilidad total
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colores.fondo }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Indicador de progreso */}
        <View style={styles.progressContainer}>
          {pasos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                {
                  backgroundColor: index <= pasoActual ? colores.primario : colores.borde,
                  width: index === pasoActual ? 24 : 8
                }
              ]}
            />
          ))}
        </View>

        {/* Contenido de pasos */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}
        >
          {pasos.map((_, index) => (
            <View key={index} style={[styles.paso, { width }]}>
              <ScrollView
                contentContainerStyle={styles.pasoScroll}
                showsVerticalScrollIndicator={false}
              >
                {renderPaso(index)}
              </ScrollView>
            </View>
          ))}
        </ScrollView>

        {/* Botones de navegacion */}
        <View style={[styles.botonesContainer, { backgroundColor: colores.fondo }]}>
          {pasoActual > 0 && (
            <TouchableOpacity
              style={[styles.btnSecundario, { borderColor: colores.borde }]}
              onPress={anterior}
            >
              <Ionicons name="arrow-back" size={20} color={colores.texto} />
              <Text style={[styles.btnSecundarioText, { color: colores.texto }]}>Atras</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.btnPrimario,
              {
                backgroundColor: validarPasoActual() ? colores.primario : colores.borde,
                flex: pasoActual === 0 ? 1 : undefined
              }
            ]}
            onPress={siguiente}
            disabled={!validarPasoActual() || guardando}
          >
            {guardando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.btnPrimarioText}>
                  {pasoActual === pasos.length - 1 ? 'Comenzar' : pasoActual === 0 ? 'Empezar' : 'Siguiente'}
                </Text>
                {pasoActual < pasos.length - 1 && (
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                )}
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6
  },
  progressDot: {
    height: 8,
    borderRadius: 4
  },
  scrollView: {
    flex: 1
  },
  paso: {
    flex: 1
  },
  pasoScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30
  },
  pasoContent: {
    alignItems: 'stretch'
  },
  pasoTitulo: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10
  },
  pasoSubtitulo: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    borderWidth: 1
  },
  btnOpcion: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  btnOpcionRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  btnOpcionTextos: {
    flex: 1,
    marginLeft: 15
  },
  btnOpcionLabel: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  btnOpcionDesc: {
    fontSize: 14,
    marginTop: 2
  },
  gridDias: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20
  },
  diaCirculo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center'
  },
  diaTexto: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  infoText: {
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic'
  },
  botonesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12
  },
  btnSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8
  },
  btnSecundarioText: {
    fontSize: 16,
    fontWeight: '600'
  },
  btnPrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    flex: 1
  },
  btnPrimarioText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
