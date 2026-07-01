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
 *
 * Push remoto vs local:
 * - Las alarmas locales (RF-064) NO necesitan FCM: las agenda expo-
 *   notifications contra el SO y las dispara el OS, no la red.
 * - El push remoto (servidor → celular para recordatorios push) SÍ
 *   necesita FCM en Android, lo que requiere configurar
 *   `android.googleServicesFile` en app.json con el google-services.json
 *   de un proyecto Firebase + subir las credenciales FCM a Expo.
 * - En v0.1.0 las alarmas locales son suficientes. Si el archivo no
 *   está configurado, salimos silenciosamente con un info en vez de
 *   un warn, porque no es un bug sino una feature opcional apagada.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import {
  eliminarDispositivoActual as apiEliminarDispositivo,
  registrarDispositivo as apiRegistrarDispositivo,
} from '@/features/dispositivos/api';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { useAuthStore } from '@/stores/auth';

/**
 * Devuelve true si la config de Expo tiene googleServicesFile seteado
 * para Android (lo que indica que FCM está inicializado). En iOS o
 * en desarrollo sin Firebase configurado devuelve false.
 */
function fcmEstaConfigurado(): boolean {
  const gsFile = Constants.expoConfig?.android?.googleServicesFile;
  return typeof gsFile === 'string' && gsFile.length > 0;
}

export function PushTokenRegistrar(): null {
  const user = useAuthStore((s) => s.user);
  const tokenRegistradoRef = useRef<string | null>(null);

  useEffect(() => {
    if (user) {
      // Post-auth: registrar push token
      void (async () => {
        // Sin googleServicesFile no podemos obtener el push token en
        // Android (FCM no inicializado). Salimos silenciosamente: las
        // alarmas locales siguen funcionando, solo no recibimos pushes
        // remotos. Para habilitar push remoto, hay que configurar
        // Firebase y subir credenciales FCM a EAS (ver docs Expo).
        if (Platform.OS === 'android' && !fcmEstaConfigurado()) {
          console.info(
            '[push] FCM no configurado (googleServicesFile ausente). ' +
              'Push remoto deshabilitado; alarmas locales OK.',
          );
          return;
        }

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
