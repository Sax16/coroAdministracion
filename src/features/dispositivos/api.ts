/**
 * API de dispositivos contra Supabase.
 *
 * Cubre RF-085: registro de push token. La Edge Function `notificar-push`
 * lee los tokens de esta tabla para enviar las push.
 *
 * Flujo:
 * 1. La app pide el push token a Expo (`Notifications.getExpoPushTokenAsync()`)
 * 2. La app llama a `registrarDispositivo()` con ese token
 * 3. La Edge Function consulta `dispositivos` filtrado por destinatarios
 *
 * El token se guarda con `onConflict: 'expo_push_token'` (UPSERT) para
 * que cada apertura actualice `last_seen_at` sin duplicar filas. Si el
 * usuario cambia de celular, se crea una fila nueva para el nuevo token
 * (la del celular viejo queda hasta que se limpie con RF-086).
 */
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { Result } from '@/lib/result';

import { Dispositivo, Plataforma } from './types';

function mapErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Registra (o actualiza) el push token del dispositivo actual.
 *
 * Si el token ya existe (porque el usuario reabrió la app), se actualiza
 * `last_seen_at` y `app_version`. Si es nuevo, se inserta.
 *
 * Devuelve el id del dispositivo registrado.
 */
export async function registrarDispositivo(input: {
  expo_push_token: string;
  app_version?: string;
  plataforma?: Plataforma;
}): Promise<Result<{ id: string }>> {
  try {
    const { data: userData, error: errUser } = await supabase.auth.getUser();
    if (errUser || !userData.user) {
      return { ok: false, error: 'No hay sesión activa' };
    }

    const plataforma = input.plataforma ?? (Platform.OS === 'ios' ? 'ios' : 'android');

    const { data, error } = await supabase
      .from('dispositivos')
      .upsert(
        {
          usuario_id: userData.user.id,
          expo_push_token: input.expo_push_token,
          plataforma,
          app_version: input.app_version ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'expo_push_token' },
      )
      .select('id')
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/**
 * Elimina el push token del dispositivo actual. Llamar en signOut
 * para no recibir push después de cerrar sesión.
 *
 * Solo elimina las filas del usuario actual (RLS lo enforcea).
 */
export async function eliminarDispositivoActual(): Promise<Result<{ count: number }>> {
  try {
    const { data: userData, error: errUser } = await supabase.auth.getUser();
    if (errUser || !userData.user) {
      return { ok: false, error: 'No hay sesión activa' };
    }

    const { data, error } = await supabase
      .from('dispositivos')
      .delete()
      .eq('usuario_id', userData.user.id)
      .select('id');

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { count: data?.length ?? 0 } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/** Elimina UN dispositivo específico por su token. */
export async function eliminarDispositivoPorToken(
  expoPushToken: string,
): Promise<Result<{ count: number }>> {
  try {
    const { data, error } = await supabase
      .from('dispositivos')
      .delete()
      .eq('expo_push_token', expoPushToken)
      .select('id');

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { count: data?.length ?? 0 } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/** Lista los dispositivos del usuario actual. Útil para debug / settings. */
export async function listarMisDispositivos(): Promise<Result<Dispositivo[]>> {
  try {
    const { data, error } = await supabase
      .from('dispositivos')
      .select('*')
      .order('last_seen_at', { ascending: false });

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as Dispositivo[] };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}
