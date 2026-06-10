/**
 * Store de autenticación (Zustand).
 *
 * Mantiene la sesión activa del usuario y un flag `hydrated` que indica
 * si ya intentamos leer la sesión de Supabase al iniciar la app.
 *
 * TODO (post-bootstrap):
 * - Implementar `signIn(email, password)` con Supabase Auth.
 * - Implementar `signOut()`.
 * - Hidratar la sesión al montar la app (`hydrate()`).
 * - Suscribirse a `supabase.auth.onAuthStateChange` para reflejar
 *   cambios externos (token refresh, sign-out en otro dispositivo).
 */
import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  hydrated: boolean;
  setUser: (user: AuthUser | null) => void;
  setHydrated: (hydrated: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  setUser: (user) => set({ user }),
  setHydrated: (hydrated) => set({ hydrated }),
  reset: () => set({ user: null, hydrated: false }),
}));
