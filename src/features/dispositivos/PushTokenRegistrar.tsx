/**
 * Componente invisible que registra/limpia el push token del dispositivo
 * según el estado de auth.
 *
 * Lógica:
 * - Si hay user: pide el push token a Expo y lo upsert en `dispositivos`.
 *   Usa un ref para no re-registrar en cada render.
 * - Si no hay user: limpia el push token del usuario que acaba de
 *   cerrar sesión (no de cualquiera — solo del actual).
 *
 * Se monta en `app/(app)/_layout.tsx`. No renderiza nada.
 *
 * Decisión: la app cliente usa este componente para registrar SU push
 * token, pero NO es responsable de mandar push a otros — eso lo hace
 * la Edge Function `notificar-push` leyendo de la tabla `dispositivos`.
 */
import { useEffect, useRef } from 'react';

import {
  eliminarDispositivoActual as apiEliminarDispositivo,
  registrarDispositivo as apiRegistrarDispositivo,
} from '@/features/dispositivos/api';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { useAuthStore } from '@/stores/auth';

export function PushTokenRegistrar(): null {
  const user = useAuthStore((s) => s.user);
  const tokenRegistradoRef = useRef<string | null>(null);

  useEffect(() => {
    if (user) {
      // Post-auth: registrar push token
      void (async () => {
        try {
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
          });
          const token = tokenData.data;
          if (!token || token === tokenRegistradoRef.current) return;

          const appVersion =
            Constants.expoConfig?.version ??
            (Constants as unknown as { manifest?: { version?: string } }).manifest?.version ??
            undefined;

          const result = await apiRegistrarDispositivo({
            expo_push_token: token,
            app_version: appVersion,
          });
          if (result.ok) {
            tokenRegistradoRef.current = token;
          } else {
            console.warn('[push] No se pudo registrar dispositivo:', result.error);
          }
        } catch (e) {
          console.warn('[push] Error registrando token:', e);
        }
      })();
    } else {
      // Sign-out: limpiar el push token del usuario que cerró sesión.
      // No bloqueamos el flujo de sign-out.
      if (tokenRegistradoRef.current) {
        void apiEliminarDispositivo().catch((e) => {
          console.warn('[push] Error limpiando token:', e);
        });
        tokenRegistradoRef.current = null;
      }
    }
  }, [user]);

  return null;
}
