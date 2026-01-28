import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';

interface WorkoutContextType {
  rutinaActiva: any | null;
  tiempo: number;
  estaActivo: boolean;
  iniciarRutina: (rutina: any) => void;
  finalizarRutina: (callbackGuardar: Function) => void;
  cancelarRutina: () => void;
  minimizar: () => void;
  resumir: () => void;
  pausarCronometro: () => void;
  reanudarCronometro: () => void;
  setRutinaActiva: React.Dispatch<any>; // <--- Añadido para que funcione rutinas.tsx
}

const WorkoutContext = createContext<WorkoutContextType>({} as WorkoutContextType);

export const useWorkout = () => useContext(WorkoutContext);

export const WorkoutProvider = ({ children }: { children: React.ReactNode }) => {
  const [rutinaActiva, setRutinaActiva] = useState<any | null>(null);
  const [tiempo, setTiempo] = useState(0);
  const [estaActivo, setEstaActivo] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (rutinaActiva && estaActivo) {
      timerRef.current = setInterval(() => {
        setTiempo((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [rutinaActiva, estaActivo]);

  const iniciarRutina = (rutina: any) => {
    if (rutinaActiva) {
      Alert.alert("Ya hay una rutina en curso", "¿Quieres descartarla?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Descartar", style: "destructive", onPress: () => {
           setRutinaActiva(rutina);
           setTiempo(0);
           setEstaActivo(true);
           setMinimizado(false);
        }}
      ]);
      return;
    }
    setRutinaActiva(rutina);
    setTiempo(0);
    setEstaActivo(true);
    setMinimizado(false);
  };

  const cancelarRutina = () => {
    Alert.alert("¿Descartar entrenamiento?", "Se perderá el progreso actual.", [
      { text: "Seguir entrenando", style: "cancel" },
      { 
        text: "Descartar", 
        style: "destructive", 
        onPress: () => {
          setRutinaActiva(null);
          setTiempo(0);
          setEstaActivo(false);
        }
      }
    ]);
  };

  const finalizarRutina = async (callbackGuardar: Function) => {
    setEstaActivo(false);
    await callbackGuardar(tiempo, rutinaActiva);
    setRutinaActiva(null);
    setTiempo(0);
  };

  const pausarCronometro = () => setEstaActivo(false);
  const reanudarCronometro = () => setEstaActivo(true);
  const minimizar = () => setMinimizado(true);
  const resumir = () => setMinimizado(false);

  return (
    <WorkoutContext.Provider value={{
      rutinaActiva,
      tiempo,
      estaActivo,
      iniciarRutina,
      finalizarRutina,
      cancelarRutina,
      minimizar,
      resumir,
      pausarCronometro,
      reanudarCronometro,
      setRutinaActiva
    }}>
      {children}
    </WorkoutContext.Provider>
  );
};