// hooks/useAppColors.ts
// Hook centralizado para colores de la app según el tema

import { useColorScheme } from 'react-native';
import { useTheme } from '../components/ThemeContext';

export interface AppColors {
  fondo: string;
  tarjeta: string;
  texto: string;
  subtexto: string;
  borde: string;
  inputBg: string;
  primario: string;
  danger: string;
  success: string;
  warning: string;
  // Colores específicos
  chipInactivo: string;
  chipTextoInactivo: string;
  cronometro: string;
  seccionHeader: string;
  descansoBg: string;
}

export function useAppColors(): { esOscuro: boolean; colores: AppColors } {
  const { theme } = useTheme();
  const systemScheme = useColorScheme();

  // Determinar si es modo oscuro
  const esOscuro = theme === 'dark' ? true : theme === 'light' ? false : systemScheme === 'dark';

  const colores: AppColors = {
    // Colores base
    fondo: esOscuro ? '#000000' : '#f2f2f7',
    tarjeta: esOscuro ? '#1c1c1e' : '#ffffff',
    texto: esOscuro ? '#ffffff' : '#1c1c1e',
    subtexto: esOscuro ? '#8e8e93' : '#666666',
    borde: esOscuro ? '#2c2c2e' : '#e5e5ea',
    inputBg: esOscuro ? '#2c2c2e' : '#f2f2f7',

    // Colores de acción
    primario: '#007AFF',
    danger: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',

    // Colores específicos de componentes
    chipInactivo: esOscuro ? '#2c2c2e' : '#e0e0e0',
    chipTextoInactivo: esOscuro ? '#aaaaaa' : '#555555',
    cronometro: esOscuro ? '#FFD60A' : '#E6B800',
    seccionHeader: esOscuro ? '#2c2c2e' : '#e5e5ea',
    descansoBg: esOscuro ? '#2c2c2e' : '#f1f1f1',
  };

  return { esOscuro, colores };
}

// Hook simplificado para componentes que no usan ThemeContext
export function useSimpleColors(): { esOscuro: boolean; colores: AppColors } {
  const systemScheme = useColorScheme();
  const esOscuro = systemScheme === 'dark';

  const colores: AppColors = {
    fondo: esOscuro ? '#000000' : '#f2f2f7',
    tarjeta: esOscuro ? '#1c1c1e' : '#ffffff',
    texto: esOscuro ? '#ffffff' : '#1c1c1e',
    subtexto: esOscuro ? '#8e8e93' : '#666666',
    borde: esOscuro ? '#2c2c2e' : '#e5e5ea',
    inputBg: esOscuro ? '#2c2c2e' : '#f2f2f7',
    primario: '#007AFF',
    danger: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    chipInactivo: esOscuro ? '#2c2c2e' : '#e0e0e0',
    chipTextoInactivo: esOscuro ? '#aaaaaa' : '#555555',
    cronometro: esOscuro ? '#FFD60A' : '#E6B800',
    seccionHeader: esOscuro ? '#2c2c2e' : '#e5e5ea',
    descansoBg: esOscuro ? '#2c2c2e' : '#f1f1f1',
  };

  return { esOscuro, colores };
}
