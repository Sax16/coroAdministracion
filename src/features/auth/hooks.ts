/**
 * Hooks de React para auth.
 *
 * Encapsulan el estado y las acciones del store de auth en hooks
 * específicos. Usar SIEMPRE estos hooks desde componentes, nunca
 * `useAuthStore` directo — así es fácil mockear en tests.
 */
import { useCallback, useState } from 'react';

import { useAuthStore } from '@/stores/auth';

import { signIn as apiSignIn, signUp as apiSignUp, SignInInput, SignUpInput } from './api';

/**
 * Hook principal: expone el usuario actual y el flag hydrated.
 * `hydrated` indica si ya intentamos leer la sesión persistida.
 * Mientras `hydrated === false`, NO sabemos si hay usuario o no
 * (es el estado de "loading" inicial).
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  return { user, hydrated, isAuthenticated: !!user };
}

/**
 * Hook para el formulario de login. Maneja loading + error.
 */
export function useSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (input: SignInInput) => {
    setLoading(true);
    setError(null);
    const result = await apiSignIn(input);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { signIn, loading, error, clearError: () => setError(null) };
}

/**
 * Hook para el formulario de registro. Maneja loading + error.
 */
export function useSignUp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signUp = useCallback(async (input: SignUpInput) => {
    setLoading(true);
    setError(null);
    const result = await apiSignUp(input);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { signUp, loading, error, clearError: () => setError(null) };
}

/**
 * Hook para sign-out. Maneja loading.
 */
export function useSignOut() {
  const signOut = useAuthStore((s) => s.signOut);
  const [loading, setLoading] = useState(false);

  const doSignOut = useCallback(async () => {
    setLoading(true);
    await signOut();
    setLoading(false);
  }, [signOut]);

  return { signOut: doSignOut, loading };
}
