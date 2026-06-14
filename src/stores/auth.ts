/**
 * Store de autenticación (Zustand).
 *
 * Mantiene la sesión activa del usuario y un flag `hydrated` que indica
 * si ya intentamos leer la sesión de Supabase al iniciar la app.
 *
 * La hidratación se dispara una vez desde `app/_layout.tsx` al montar la
 * app. A partir de ahí, la suscripción a `onAuthStateChange` mantiene el
 * store sincronizado con cualquier cambio (login, logout, token refresh).
 *
 * Ver docs/03-requerimientos.md RF-001 a RF-006.
 */
import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  hydrated: boolean;

  /**
   * Hidrata la sesión desde Supabase (lee de AsyncStorage) y se suscribe
   * a onAuthStateChange. Se llama UNA vez al montar la app.
   */
  hydrate: () => Promise<void>;

  /**
   * Cierra la sesión actual. Limpia el store.
   */
  signOut: () => Promise<void>;

  /**
   * Resetea el store (usado internamente).
   */
  reset: () => void;
}

function userFromSupabase(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? '',
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  hydrated: false,

  hydrate: async () => {
    // 1. Lee la sesión persistida en AsyncStorage.
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      // Si falla la lectura (storage corrupto, etc.), seguimos sin sesión
      // y dejamos que el flujo de auth lleve al usuario al login.
      console.warn('[auth] getSession error:', error.message);
    }
    set({
      session: data.session,
      user: userFromSupabase(data.session?.user ?? null),
      hydrated: true,
    });

    // 2. Suscripción a cambios (token refresh, sign-out en otro dispositivo).
    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: userFromSupabase(session?.user ?? null),
      });
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    // onAuthStateChange va a setear user=null. No hace falta tocar el store acá,
    // pero lo hacemos explícito para que el reset sea inmediato.
    set({ user: null, session: null });
  },

  reset: () => set({ user: null, session: null, hydrated: false }),
}));
