import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';

// Tipos para el contexto de autenticación
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, nombre?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obtener sesión inicial
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        // Si hay usuario, asegurar que tiene perfil
        if (initialSession?.user) {
          await ensureUserProfile(initialSession.user.id, initialSession.user.email);
        }
      } catch (error) {
        console.error('Error al inicializar autenticación:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Cuando el usuario inicia sesión, asegurar que tiene perfil
        if (event === 'SIGNED_IN' && newSession?.user) {
          await ensureUserProfile(newSession.user.id, newSession.user.email);
        }

        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Crear perfil del usuario si no existe
  const ensureUserProfile = async (userId: string, email?: string) => {
    try {
      const { data: existingProfile } = await supabase
        .from('perfil')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!existingProfile) {
        // Crear perfil para el nuevo usuario
        await supabase.from('perfil').insert({
          user_id: userId,
          nombre: email?.split('@')[0] || 'Usuario',
          objetivo: 'recomposicion',
          nivel_actividad: 'moderado',
          tema: 'system'
        });
      }
    } catch (error) {
      // El perfil puede que ya exista, ignorar errores
      console.log('Perfil verificado/creado');
    }
  };

  // Registro de usuario
  const signUp = async (email: string, password: string, nombre?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nombre: nombre || email.split('@')[0]
          }
        }
      });

      if (!error && data.user) {
        // Crear perfil inmediatamente
        await supabase.from('perfil').insert({
          user_id: data.user.id,
          nombre: nombre || email.split('@')[0],
          objetivo: 'recomposicion',
          nivel_actividad: 'moderado',
          tema: 'system'
        });
      }

      return { error };
    } catch (e) {
      return { error: e as AuthError };
    }
  };

  // Inicio de sesión
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (e) {
      return { error: e as AuthError };
    }
  };

  // Cerrar sesión
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  // Recuperar contraseña
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error };
    } catch (e) {
      return { error: e as AuthError };
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook para usar el contexto de autenticación
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
