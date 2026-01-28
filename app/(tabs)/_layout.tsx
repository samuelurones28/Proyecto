import { Tabs, useRouter, usePathname } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
// Ruta corregida: sube dos niveles (../../) para llegar a la raíz components
import { useWorkout } from '../../components/WorkoutContext'; 

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  const { rutinaActiva, tiempo, cancelarRutina } = useWorkout();

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const mostrarBarraFlotante = rutinaActiva && pathname !== '/rutinas';

  return (
    <View style={{ flex: 1 }}> 
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="rutinas"
          options={{
            title: 'Rutinas',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="flame.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="nutricion"
          options={{
            title: 'Nutrición',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="leaf.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="progreso"
          options={{
            title: 'Progreso',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
          }}
        />
        <Tabs.Screen 
          name="calendario" 
          options={{ 
            title: 'Calendario',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />, 
          }} 
        />
      </Tabs>

      {mostrarBarraFlotante && (
        <View style={styles.miniBarContainer}>
          <TouchableOpacity 
            style={styles.miniBarContent} 
            onPress={() => {
              router.push({ pathname: '/rutinas', params: { expandir: 'true' } });
            }}
          >
            <View>
              <Text style={styles.miniBarTitle}>
                Entrenando: {rutinaActiva.nombre || rutinaActiva.titulo || 'Rutina'}
              </Text>
              <Text style={styles.miniBarTime}>{formatTime(tiempo)}</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={cancelarRutina} style={styles.closeBtn}>
             <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  miniBarContainer: {
    position: 'absolute',
    bottom: 85, 
    left: 10,
    right: 10,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 9999,
  },
  miniBarContent: {
    flex: 1,
    paddingRight: 10,
  },
  miniBarTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  miniBarTime: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  closeBtn: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
  }
});