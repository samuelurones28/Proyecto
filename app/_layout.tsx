import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context'; // <--- NUEVO

import { useColorScheme } from '@/hooks/use-color-scheme';
// Nota los dos puntos ".." para salir de "app" y buscar "components"
import { ThemeProvider as CustomThemeProvider } from '../components/ThemeContext'; 
import { WorkoutProvider } from '../components/WorkoutContext';

// Ignorar advertencias específicas que no rompen la app en desarrollo
LogBox.ignoreLogs([
  'expo-notifications', 
  'Route "./components/ThemeContext.tsx"',
  'Route "./components/WorkoutContext.tsx"'
]);

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider> 
      <CustomThemeProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <WorkoutProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </WorkoutProvider>
        </ThemeProvider>
      </CustomThemeProvider>
    </SafeAreaProvider>
  );
}