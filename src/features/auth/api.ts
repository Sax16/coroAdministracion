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
