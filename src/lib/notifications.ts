/**
 * Wrapper de expo-notifications.
 *
 * Maneja dos canales (ver docs/02-stack-y-arquitectura.md §5):
 * 1. Push estándar (FCM/APNs) — categorí­a `default`.
 * 2. Alarma local — categoría `alarm`, full-screen, sonido custom, sin
 *    consumir batería porque la agenda el SO, no la app.
 *
 * TODO (post-bootstrap):
 * - Configurar la categoría `alarm` con `setNotificationCategoryAsync`.
 * - Pedir permisos (iOS + Android 13+ POST_NOTIFICATIONS).
 * - Pedir `SCHEDULE_EXACT_ALARM` (Android 12+) al primer acceso a "Mi semana".
 * - Registrar el Expo push token en la tabla `dispositivos` tras login.
 */
import * as Notifications from 'expo-notifications';

export const EXPO_PUSH_CATEGORY = 'default';
export const LOCAL_ALARM_CATEGORY = 'alarm';

export async function configureNotificationCategories() {
  await Notifications.setNotificationCategoryAsync(LOCAL_ALARM_CATEGORY, [
    { identifier: 'open', buttonTitle: 'Abrir app' },
  ]);
}

export async function requestNotificationPermissions() {
  // iOS: solicita permiso al usuario. Android 13+: pide POST_NOTIFICATIONS.
  const settings = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return settings.granted ?? false;
}
