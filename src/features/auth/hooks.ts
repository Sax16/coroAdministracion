/**
 * Hooks de React para auth.
 *
 * Encapsulan el estado y las acciones del store de auth en hooks
 * específicos. Usar SIEMPRE estos hooks desde componentes, nunca
 * `useAuthStore` directo — así es fácil mockear en tests.
 */
import { useCallback, useState } from 'react';

import { useAuthStore } from '@/stores/auth';
import { useGrupoActivoStore } from '@/stores/grupoActivo';

import {
  ActualizarPerfilInput,
  eliminarCuenta as apiEliminarCuenta,
  actualizarPerfil as apiActualizarPerfil,
  PerfilActualizado,
  signIn as apiSignIn,
  signUp as apiSignUp,
  SignInInput,
  SignUpInput,
} from './api';

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

/**
 * Hook para editar nombre y apellido del perfil propio (RF-005).
 *
 * Devuelve el row actualizado para que el caller pueda refrescar
 * la UI sin un fetch extra. El error es null en estado inicial y
 * se setea ante cualquier fallo de la query.
 */
export function useActualizarPerfil() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actualizar = useCallback(
    async (input: ActualizarPerfilInput): Promise<PerfilActualizado | null> => {
      setLoading(true);
      setError(null);
      const result = await apiActualizarPerfil(input);
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      return result.data;
    },
    [],
  );

  return { actualizar, loading, error, clearError: () => setError(null) };
}

/**
 * Hook para eliminar la cuenta del usuario actual (RF-006).
 *
 * Flujo:
 * 1. Llama a la RPC `eliminar_cuenta()` (SECURITY DEFINER).
 * 2. Si la DB lanza la excepción "Debes transferir o eliminar el grupo
 *    'X'…", la mapeamos a un error legible para mostrar en UI. Igual
 *    si falla por otra razón.
 * 3. Tras éxito, limpiamos los stores locales: el grupo activo
 *    (`clearGrupo`) y la sesión (`signOut`). El orden es:
 *    grupo → sesión. Si lo hiciéramos al revés, el `_layout` de
 *    `(app)` detectaría `user=null` y navegaría a login ANTES de
 *    que limpiemos el grupo activo, dejando el store con un grupo
 *    que la próxima sesión podría leer.
 */
export function useEliminarCuenta() {
  const signOut = useAuthStore((s) => s.signOut);
  const clearGrupo = useGrupoActivoStore((s) => s.clear);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eliminar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await apiEliminarCuenta();
    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return false;
    }
    // Cuenta borrada en el servidor. Limpiamos el estado local
    // inmediatamente. signOut() dispara onAuthStateChange que también
    // va a poner user=null, pero lo hacemos explícito para que la UI
    // reaccione ya (sin esperar el round-trip de Supabase).
    await clearGrupo();
    await signOut();
    setLoading(false);
    return true;
  }, [signOut, clearGrupo]);

  return { eliminar, loading, error, clearError: () => setError(null) };
}
