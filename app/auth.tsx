import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../components/AuthContext';
import { Ionicons } from '@expo/vector-icons';

type AuthMode = 'login' | 'register' | 'forgot';

export default function AuthScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const systemScheme = useColorScheme();
  const esOscuro = systemScheme === 'dark';

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const colores = {
    fondo: esOscuro ? '#000000' : '#f2f2f7',
    tarjeta: esOscuro ? '#1c1c1e' : '#ffffff',
    texto: esOscuro ? '#ffffff' : '#1c1c1e',
    subtexto: esOscuro ? '#8e8e93' : '#8e8e93',
    borde: esOscuro ? '#2c2c2e' : '#e5e5ea',
    inputBg: esOscuro ? '#2c2c2e' : '#f2f2f7',
    primario: '#007AFF',
    error: '#FF3B30',
    exito: '#34C759',
  };

  // Validaciones
  const validarEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validarPassword = (password: string): { valido: boolean; mensaje: string } => {
    if (password.length < 6) {
      return { valido: false, mensaje: 'La contraseña debe tener al menos 6 caracteres' };
    }
    return { valido: true, mensaje: '' };
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (!validarEmail(email)) {
      Alert.alert('Error', 'Por favor ingresa un email válido');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);

    if (error) {
      let mensaje = 'Error al iniciar sesión';
      if (error.message.includes('Invalid login credentials')) {
        mensaje = 'Email o contraseña incorrectos';
      } else if (error.message.includes('Email not confirmed')) {
        mensaje = 'Por favor confirma tu email antes de iniciar sesión';
      }
      Alert.alert('Error', mensaje);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    if (!validarEmail(email)) {
      Alert.alert('Error', 'Por favor ingresa un email válido');
      return;
    }

    const validacionPassword = validarPassword(password);
    if (!validacionPassword.valido) {
      Alert.alert('Error', validacionPassword.mensaje);
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email.trim().toLowerCase(), password, nombre.trim() || undefined);
    setLoading(false);

    if (error) {
      let mensaje = 'Error al crear la cuenta';
      if (error.message.includes('already registered')) {
        mensaje = 'Este email ya está registrado';
      }
      Alert.alert('Error', mensaje);
    } else {
      Alert.alert(
        'Cuenta creada',
        'Se ha enviado un email de confirmación. Por favor verifica tu correo antes de iniciar sesión.',
        [{ text: 'OK', onPress: () => setMode('login') }]
      );
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Por favor ingresa tu email');
      return;
    }

    if (!validarEmail(email)) {
      Alert.alert('Error', 'Por favor ingresa un email válido');
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email.trim().toLowerCase());
    setLoading(false);

    if (error) {
      Alert.alert('Error', 'No se pudo enviar el email de recuperación');
    } else {
      Alert.alert(
        'Email enviado',
        'Revisa tu correo para restablecer tu contraseña',
        [{ text: 'OK', onPress: () => setMode('login') }]
      );
    }
  };

  const renderLogin = () => (
    <>
      <Text style={[styles.titulo, { color: colores.texto }]}>Bienvenido</Text>
      <Text style={[styles.subtitulo, { color: colores.subtexto }]}>
        Inicia sesión para continuar
      </Text>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colores.subtexto }]}>Email</Text>
        <View style={[styles.inputWrapper, { backgroundColor: colores.inputBg, borderColor: colores.borde }]}>
          <Ionicons name="mail-outline" size={20} color={colores.subtexto} />
          <TextInput
            style={[styles.input, { color: colores.texto }]}
            placeholder="tu@email.com"
            placeholderTextColor={colores.subtexto}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colores.subtexto }]}>Contraseña</Text>
        <View style={[styles.inputWrapper, { backgroundColor: colores.inputBg, borderColor: colores.borde }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colores.subtexto} />
          <TextInput
            style={[styles.input, { color: colores.texto }]}
            placeholder="Tu contraseña"
            placeholderTextColor={colores.subtexto}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colores.subtexto}
            />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={() => setMode('forgot')} style={styles.forgotLink}>
        <Text style={[styles.forgotText, { color: colores.primario }]}>
          ¿Olvidaste tu contraseña?
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnPrimario, { backgroundColor: colores.primario }]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.btnPrimarioText}>Iniciar Sesión</Text>
        )}
      </TouchableOpacity>

      <View style={styles.switchContainer}>
        <Text style={[styles.switchText, { color: colores.subtexto }]}>
          ¿No tienes cuenta?{' '}
        </Text>
        <TouchableOpacity onPress={() => setMode('register')}>
          <Text style={[styles.switchLink, { color: colores.primario }]}>Regístrate</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderRegister = () => (
    <>
      <Text style={[styles.titulo, { color: colores.texto }]}>Crear Cuenta</Text>
      <Text style={[styles.subtitulo, { color: colores.subtexto }]}>
        Completa tus datos para registrarte
      </Text>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colores.subtexto }]}>Nombre (opcional)</Text>
        <View style={[styles.inputWrapper, { backgroundColor: colores.inputBg, borderColor: colores.borde }]}>
          <Ionicons name="person-outline" size={20} color={colores.subtexto} />
          <TextInput
            style={[styles.input, { color: colores.texto }]}
            placeholder="Tu nombre"
            placeholderTextColor={colores.subtexto}
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="words"
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colores.subtexto }]}>Email *</Text>
        <View style={[styles.inputWrapper, { backgroundColor: colores.inputBg, borderColor: colores.borde }]}>
          <Ionicons name="mail-outline" size={20} color={colores.subtexto} />
          <TextInput
            style={[styles.input, { color: colores.texto }]}
            placeholder="tu@email.com"
            placeholderTextColor={colores.subtexto}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colores.subtexto }]}>Contraseña *</Text>
        <View style={[styles.inputWrapper, { backgroundColor: colores.inputBg, borderColor: colores.borde }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colores.subtexto} />
          <TextInput
            style={[styles.input, { color: colores.texto }]}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={colores.subtexto}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colores.subtexto}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colores.subtexto }]}>Confirmar Contraseña *</Text>
        <View style={[styles.inputWrapper, { backgroundColor: colores.inputBg, borderColor: colores.borde }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colores.subtexto} />
          <TextInput
            style={[styles.input, { color: colores.texto }]}
            placeholder="Repite tu contraseña"
            placeholderTextColor={colores.subtexto}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.btnPrimario, { backgroundColor: colores.primario }]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.btnPrimarioText}>Crear Cuenta</Text>
        )}
      </TouchableOpacity>

      <View style={styles.switchContainer}>
        <Text style={[styles.switchText, { color: colores.subtexto }]}>
          ¿Ya tienes cuenta?{' '}
        </Text>
        <TouchableOpacity onPress={() => setMode('login')}>
          <Text style={[styles.switchLink, { color: colores.primario }]}>Inicia sesión</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderForgot = () => (
    <>
      <TouchableOpacity onPress={() => setMode('login')} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={colores.texto} />
      </TouchableOpacity>

      <Text style={[styles.titulo, { color: colores.texto }]}>Recuperar Contraseña</Text>
      <Text style={[styles.subtitulo, { color: colores.subtexto }]}>
        Te enviaremos un enlace para restablecer tu contraseña
      </Text>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colores.subtexto }]}>Email</Text>
        <View style={[styles.inputWrapper, { backgroundColor: colores.inputBg, borderColor: colores.borde }]}>
          <Ionicons name="mail-outline" size={20} color={colores.subtexto} />
          <TextInput
            style={[styles.input, { color: colores.texto }]}
            placeholder="tu@email.com"
            placeholderTextColor={colores.subtexto}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.btnPrimario, { backgroundColor: colores.primario }]}
        onPress={handleForgotPassword}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.btnPrimarioText}>Enviar Enlace</Text>
        )}
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colores.fondo }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <View style={[styles.logoCircle, { backgroundColor: colores.primario }]}>
              <Ionicons name="fitness" size={50} color="white" />
            </View>
            <Text style={[styles.logoText, { color: colores.texto }]}>AI Fitness Coach</Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: colores.tarjeta }]}>
            {mode === 'login' && renderLogin()}
            {mode === 'register' && renderRegister()}
            {mode === 'forgot' && renderForgot()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  formCard: {
    padding: 25,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  backButton: {
    marginBottom: 15,
  },
  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitulo: {
    fontSize: 15,
    marginBottom: 25,
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -8,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '500',
  },
  btnPrimario: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnPrimarioText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 25,
  },
  switchText: {
    fontSize: 15,
  },
  switchLink: {
    fontSize: 15,
    fontWeight: '600',
  },
});
