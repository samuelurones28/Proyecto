import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { LogBox, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useState, useEffect, createContext, useContext } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeProvider as CustomThemeProvider } from '../components/ThemeContext';
import { WorkoutProvider } from '../components/WorkoutContext';
import { AuthProvider, useAuth } from '../components/AuthContext';
import { supabase } from '../supabase';
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

// Contexto para el estado del onboarding
interface OnboardingContextType {
  onboardingCompleto: boolean | null;
  setOnboardingCompleto: (value: boolean) => void;
  verificarOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType>({
  onboardingCompleto: null,
  setOnboardingCompleto: () => {},
  verificarOnboarding: async () => {}
});

export const useOnboarding = () => useContext(OnboardingContext);

function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [onboardingCompleto, setOnboardingCompleto] = useState<boolean | null>(null);
  const { user } = useAuth();

  const verificarOnboarding = async () => {
    if (!user) {
      setOnboardingCompleto(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('perfil')
        .select('onboarding_completado, nombre')
        .eq('user_id', user.id)
        .limit(1);

      if (error) throw error;

      // Si no hay perfil o el onboarding no está completado
      if (!data || data.length === 0 || !data[0].onboarding_completado) {
        setOnboardingCompleto(false);
      } else {
        setOnboardingCompleto(true);
      }
    } catch (e) {
      console.error('Error verificando onboarding:', e);
      setOnboardingCompleto(false);
    }
  };

  useEffect(() => {
    if (user) {
      verificarOnboarding();
    }
  }, [user]);

  return (
    <OnboardingContext.Provider value={{ onboardingCompleto, setOnboardingCompleto, verificarOnboarding }}>
      {children}
    </OnboardingContext.Provider>
  );
}

function NavigationHandler({ children }: { children: React.ReactNode }) {
  const { onboardingCompleto } = useOnboarding();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) return;
    if (onboardingCompleto === null) return;

    const enOnboarding = segments[0] === 'onboarding';

    if (!onboardingCompleto && !enOnboarding) {
      router.replace('/onboarding');
    } else if (onboardingCompleto && enOnboarding) {
      router.replace('/(tabs)');
    }
  }, [onboardingCompleto, segments, navigationState?.key]);

  // Mostrar loading mientras se verifica el estado del onboarding
  if (onboardingCompleto === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <>{children}</>;
}

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

  // Usuario autenticado, mostrar la app con onboarding check
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <WorkoutProvider>
        <OnboardingProvider>
          <NavigationHandler>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </NavigationHandler>
        </OnboardingProvider>
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
