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
import { supabase } from '../supabase';

// Ignorar advertencias específicas que no rompen la app en desarrollo
LogBox.ignoreLogs([
  'expo-notifications',
  'Route "./components/ThemeContext.tsx"',
  'Route "./components/WorkoutContext.tsx"'
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

  const verificarOnboarding = async () => {
    try {
      const { data, error } = await supabase
        .from('perfil')
        .select('onboarding_completado, nombre')
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
    verificarOnboarding();
  }, []);

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

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <CustomThemeProvider>
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
      </CustomThemeProvider>
    </SafeAreaProvider>
  );
}