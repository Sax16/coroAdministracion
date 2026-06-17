/**
 * API de autenticación contra Supabase.
 *
 * Capa fina sobre `supabase.auth` que:
 * - Centraliza el manejo de errores.
 * - Define tipos de retorno consistentes.
 * - Aísla el resto de la app de la SDK de Supabase (fácil de mockear
 *   en tests, fácil de cambiar de provider).
 */
import { AuthError, AuthResponse } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function mapError(err: AuthError | null | undefined): string {
  if (!err) return 'Error desconocido';
  // Mensajes en español para el usuario final.
  switch (err.message) {
    case 'Invalid login credentials':
      return 'Email o contraseña incorrectos';
    case 'User already registered':
      return 'Ya existe una cuenta con este email';
    case 'Password should be at least 6 characters':
      return 'La contraseña debe tener al menos 6 caracteres';
    default:
      return err.message;
  }
}

function mapResponse<T>(response: AuthResponse): AuthResult<T> {
  if (response.error) {
    return { ok: false, error: mapError(response.error) };
  }
  if (!response.data) {
    return { ok: false, error: 'Sin datos en la respuesta' };
  }
  return { ok: true, data: response.data as T };
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
}

/**
 * Inicia sesión con email y contraseña.
 */
export async function signIn(input: SignInInput) {
  const response = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  return mapResponse(response);
}

/**
 * Registra un usuario nuevo. El trigger `handle_new_user` en la DB
 * crea automáticamente la fila en `public.perfiles` con el nombre y
 * apellido que pasamos en `options.data`.
 */
export async function signUp(input: SignUpInput) {
  const response = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        nombre: input.nombre.trim(),
        apellido: input.apellido.trim(),
      },
    },
  });
  return mapResponse(response);
}

/**
 * Envía un email de recuperación de contraseña.
 */
export async function resetPassword(email: string) {
  const response = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
  );
  if (response.error) {
    return { ok: false as const, error: mapError(response.error) };
  }
  return { ok: true as const, data: null };
}

export interface ActualizarPerfilInput {
  nombre: string;
  apellido: string;
}

export interface PerfilActualizado {
  nombre: string;
  apellido: string;
}

/**
 * Actualiza nombre y apellido del perfil del usuario actual (RF-005).
 *
 * Implementación: UPDATE directo a `public.perfiles` filtrado por
 * `id = auth.uid()`. La policy "perfiles: actualizar el propio"
 * garantiza que un usuario solo puede editar su propio perfil, así
 * que no hace falta un WHERE explícito con el id del store — `eq('id', uid)`
 * lo deja claro y robusto si en el futuro se cambia la policy.
 *
 * El trigger `trg_perfiles_set_updated_at` actualiza `updated_at`
 * automáticamente.
 *
 * **Scope MVP:** nombre y apellido. Foto y teléfono requieren Supabase
 * Storage + image picker y se dejan para v0.2.0.
 */
export async function actualizarPerfil(
  input: ActualizarPerfilInput,
): Promise<AuthResult<PerfilActualizado>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    return { ok: false, error: 'No hay sesión activa' };
  }

  const { data, error } = await supabase
    .from('perfiles')
    .update({
      nombre: input.nombre.trim(),
      apellido: input.apellido.trim(),
    })
    .eq('id', userId)
    .select('nombre, apellido')
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: 'No se pudo actualizar el perfil' };
  }
  return { ok: true, data };
}

/**
 * Elimina la cuenta del usuario actual.
 *
 * Implementación: invoca la SECURITY DEFINER function `eliminar_cuenta()`
 * que ejecuta la lógica transaccional:
 *   1. Verifica que el usuario no sea admin de ningún grupo activo.
 *      Si lo es, lanza `raise exception` con el nombre del grupo.
 *   2. Marca todas las membresías (`usuarios_grupos.estado`) como `inactivo`.
 *   3. DELETE en `public.perfiles` — el FK `perfiles.id references
 *      auth.users(id) on delete cascade` borra el usuario de auth.
 *
 * Decisión de UX: la regla "no podés ser admin" se valida PRIMERO en la
 * UI (RF-006) y solo después se llama a esta función. Pero la validación
 * en la DB es la garantía dura: aunque la UI tenga un bug, la DB rechaza
 * el borrado con un mensaje claro.
 *
 * **Importante:** esta función NO cierra la sesión local. Eso es
 * responsabilidad del caller (`useEliminarCuenta`), que además limpia
 * los stores para que la app no quede en estado zombie.
 */
export async function eliminarCuenta(): Promise<AuthResult<null>> {
  const { error } = await supabase.rpc('eliminar_cuenta');
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}
