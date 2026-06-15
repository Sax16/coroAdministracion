/**
 * Hooks de la feature dispositivos (push tokens).
 */
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';

import Constants from 'expo-constants';

import {
  eliminarDispositivoActual,
  registrarDispositivo as apiRegistrarDispositivo,
} from './api';

/**
 * Hook que registra el push token del dispositivo una vez, post-auth.
 * Llamar en el root layout o en la pantalla post-login.
 *
 * Decisiones:
 * - Pide el push token con `Notifications.getExpoPushTokenAsync()`.
 *   En Expo Go puede fallar; en dev builds y production builds anda.
 * - Hace upsert: si el token ya existe, actualiza `last_seen_at`.
 * - Si Expo devuelve error (ej. corriendo en Expo Go sin permisos),
 *   lo loguea y sigue — la app no se rompe.
 * - Usa un `useRef` para evitar re-registros en cada render.
 */
export function useRegistrarPushToken(): {
  pushToken: string | null;
  loading: boolean;
  error: string | null;
  registrar: () => Promise<void>;
} {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registrado = useRef(false);

  const registrar = useCallback(async () => {
    if (registrado.current) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Pedir el push token a Expo
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      const token = tokenData.data;
      if (!token) {
        setError('No se pudo obtener el push token');
        setLoading(false);
        return;
      }

      // 2. Registrar/actualizar en la DB
      const appVersion =
        Constants.expoConfig?.version ??
        (Constants as unknown as { manifest?: { version?: string } }).manifest?.version ??
        null;

      const result = await apiRegistrarDispositivo({
        expo_push_token: token,
        app_version: appVersion ?? undefined,
      });

      if (!result.ok) {
        setError(result.error);
      } else {
        setPushToken(token);
        registrado.current = true;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void registrar();
  }, [registrar]);

  return { pushToken, loading, error, registrar };
}

/**
 * Hook que elimina el push token del usuario actual. Usar en signOut.
 */
export function useEliminarPushToken(): {
  loading: boolean;
  error: string | null;
  eliminar: () => Promise<boolean>;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eliminar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await eliminarDispositivoActual();
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { loading, error, eliminar };
}
