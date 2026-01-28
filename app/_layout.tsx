import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { LogBox, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeProvider as CustomThemeProvider } from '../components/ThemeContext';
import { WorkoutProvider } from '../components/WorkoutContext';
import { AuthProvider, useAuth } from '../components/AuthContext';
import AuthScreen from './auth';

// Ignorar advertencias específicas que no rompen la app en desarrollo
LogBox.ignoreLogs([
  'expo-notifications',
  'Route "./components/ThemeContext.tsx"',
  'Route "./components/WorkoutContext.tsx"',
  'Route "./components/AuthContext.tsx"'
]);

export const unstable_settings = {
  anchor: '(tabs)',
};

// Componente que maneja la navegación basada en autenticación
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading } = useAuth();

  // Mostrar loading mientras se verifica la sesión
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#000' : '#f2f2f7' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Si no hay usuario, mostrar pantalla de autenticación
  if (!user) {
    return <AuthScreen />;
  }

  // Usuario autenticado, mostrar la app
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <WorkoutProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </WorkoutProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CustomThemeProvider>
          <RootLayoutNav />
        </CustomThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}