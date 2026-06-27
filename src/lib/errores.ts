/**
 * Mapeo centralizado de errores a mensajes en español para el usuario final.
 *
 * Dos helpers, una sola fuente de verdad (antes estaban duplicados en cada
 * `features/<x>/api.ts`):
 *
 * - `mapErr(e)`     — normaliza cualquier valor capturado en un `catch` a string.
 * - `mapSupabaseError(error)` — traduce un error de Supabase/Postgres (PostgREST,
 *   Auth, violación de RLS) a un mensaje amigable en español. Evita filtrar
 *   texto técnico en inglés; ante algo no contemplado, devuelve un genérico.
 *
 * Las APIs de features pueden seguir devolviendo mensajes MÁS específicos por
 * caso (ej. un 23505 puntual) y dejar `mapSupabaseError` como fallback.
 */
import type { AuthError, PostgrestError } from '@supabase/supabase-js';

type ErrorLike =
  | PostgrestError
  | AuthError
  | { message?: string; code?: string }
  | null
  | undefined;

/** Normaliza un valor lanzado (catch) a string. */
export function mapErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Traduce un error de Supabase/Postgres a un mensaje en español apto para la UI.
 * Cubre los SQLSTATE más comunes, violaciones de RLS y los mensajes de Auth.
 */
export function mapSupabaseError(error: ErrorLike): string {
  if (!error) return 'Ocurrió un error inesperado. Intentá de nuevo.';

  const code = 'code' in error ? error.code : undefined;
  const msg = error.message ?? '';

  // 0. Mensajes deliberados de nuestras funciones SECURITY DEFINER
  //    (raise exception en PL/pgSQL -> SQLSTATE P0001). Vienen en español y
  //    pensados para el usuario (ej. "Solo el admin puede eliminar el grupo"),
  //    así que se devuelven tal cual.
  if (code === 'P0001' && msg) return msg;

  // 1. Códigos SQLSTATE de Postgres (PostgrestError.code)
  switch (code) {
    case '23505': // unique_violation
      return 'Ya existe un registro con esos datos.';
    case '23503': // foreign_key_violation
      return 'No se puede completar: hay datos relacionados.';
    case '23502': // not_null_violation
      return 'Faltan datos obligatorios.';
    case '23514': // check_violation
      return 'Algún dato no cumple las validaciones.';
    case '42501': // insufficient_privilege
      return 'No tenés permiso para esta acción.';
    case 'PGRST116': // 0 filas en .single()
      return 'No se encontró el registro.';
  }

  // 2. Mensajes de Supabase Auth (no traen un code útil)
  switch (msg) {
    case 'Invalid login credentials':
      return 'Email o contraseña incorrectos.';
    case 'User already registered':
      return 'Ya existe una cuenta con este email.';
    case 'Password should be at least 6 characters':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'Email not confirmed':
      return 'Tenés que confirmar tu email antes de iniciar sesión.';
  }

  // 3. Patrones en el mensaje (RLS / sesión)
  if (/row-level security/i.test(msg)) return 'No tenés permiso para esta acción.';
  if (/JWT|not authenticated|session/i.test(msg)) {
    return 'Tu sesión expiró. Volvé a iniciar sesión.';
  }

  // 4. Fallback: no filtrar texto técnico en inglés
  return 'No se pudo completar la operación. Intentá de nuevo.';
}
