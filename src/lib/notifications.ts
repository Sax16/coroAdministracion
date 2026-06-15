/**
 * Wrapper sobre `expo-notifications` para la pantalla "Mi semana" (RF-055,
 * RF-063, RF-064).
 *
 * Decisiones de diseño (de docs/02-stack-y-arquitectura.md §5):
 * - Al abrir "Mi semana", agendamos una `local notification` por cada
 *   asignación del usuario, con trigger = `fecha_inicio - offset_min`.
 *   El SO es el que la dispara, no la app. No hay código en background.
 * - En Android usamos un canal con `IMPORTANCE_HIGH` y categoría custom
 *   `alarm` (en iOS también) para que la notificación se muestre como
 *   banner + suene fuerte, aunque el celular esté en No Molestar.
 * - Para Android 12+ (RF-064) pedimos `SCHEDULE_EXACT_ALARM` la primera
 *   vez que el usuario entra a "Mi semana". Si lo deniega, las alarmas
 *   se agendan igual pero pueden no sonar a la hora exacta (Doze mode
 *   puede retrasarlas). En la práctica Android 14+ es bastante
 *   permisivo con apps de calendario/alarma, pero el permission check
 *   es defensivo.
 * - El sonido custom (`alarm.wav`) queda como TODO v0.2.0. Por ahora
 *   usamos el sonido default. El bundle del proyecto no tiene el
 *   archivo y agregarlo requiere un asset + rebuild nativo.
 *
 * API expuesta:
 * - `configureNotifications()`: setea el handler global, registra
 *   categoría 'alarm' y crea el canal Android. Llamar una vez al
 *   boot de la app.
 * - `pedirPermisosAlarma()`: pide permiso de notificaciones + exacto
 *   en Android. Devuelve un Result con el estado final.
 * - `scheduleAlarm({servicioId, fechaInicio, offsetMin, titulo})`:
 *   agenda una alarma local.
 * - `cancelAlarmsDeServicio(servicioId)`: cancela todas las alarmas
 *   agendadas para un servicio (útil si el admin edita el patrón
 *   y se re-generan servicios).
 * - `cancelAllAlarms()`: limpia todas las alarmas agendadas.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as PermissionsAndroid from 'react-native/Libraries/PermissionsAndroid/PermissionsAndroid';

import { Result } from '@/lib/result';

const CHANNEL_ID = 'alarm';
const CATEGORY_ID = 'alarm';

/**
 * Storage interno de los identificadores de notificación por servicio.
 * expo-notifications devuelve IDs opacos; los guardamos en este Map
 * en memoria para poder cancelar selectivamente. La pantalla los
 * hidrata al montar y los limpia al desmontar.
 *
 * Limitación: si la app se mata y reabre, este Map se pierde. Las
 * alarmas quedan agendadas en el SO, pero no podemos cancelarlas
 * por servicio — solo `cancelAllScheduledNotificationsAsync()`. Para
 * v0.1.0 aceptable; v0.2.0 mover a AsyncStorage.
 */
const alarmasPorServicio = new Map<string, string[]>();

let configured = false;

// =============================================================================
// Configuración inicial
// =============================================================================

/**
 * Configura el handler global, registra la categoría 'alarm' y crea
 * el canal Android. Idempotente: se puede llamar múltiples veces.
 */
export function configureNotifications(): void {
  if (configured) return;
  configured = true;

  // Handler global: cuando llega una notificación, mostrarla como banner
  // y en la lista, con sonido, sin badge.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // Categoría 'alarm' con un botón "Abrir app" (iOS y Android 8+)
  void Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    { identifier: 'open', buttonTitle: 'Abrir app' },
  ]);

  // Canal Android con importance HIGH (banners, heads-up, sound)
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Alarmas de servicios',
      description: 'Avisos sonoros antes de cada servicio asignado',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }
}

// =============================================================================
// Permisos
// =============================================================================

/**
 * Pide permiso de notificaciones + SCHEDULE_EXACT_ALARM (Android 12+).
 * Devuelve el estado final: 'granted' | 'denied' | 'undetermined'.
 *
 * El permission de notificaciones es único (iOS y Android modernos).
 * En Android 13+ el SO lo pide como runtime permission; en iOS pide
 * al instalar/primer uso. Si el usuario ya lo denegó, no volvemos
 * a preguntar — debe ir a Settings manualmente.
 */
export async function pedirPermisosAlarma(): Promise<
  Result<'granted' | 'denied' | 'undetermined'>
> {
  try {
    // 1. Permiso de notificaciones (iOS y Android 13+)
    const settings = await Notifications.getPermissionsAsync();
    let finalStatus = settings.status;

    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: false,
          allowSound: true,
          allowDisplayInCarPlay: false,
        },
      });
      finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
      return { ok: true, data: finalStatus };
    }

    // 2. SCHEDULE_EXACT_ALARM en Android 12+ (RF-064)
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      try {
        // En RN 0.85 el enum `PERMISSIONS` no incluye `SCHEDULE_EXACT_ALARM`
        // (es un permission custom de la app, no un "dangerous permission"
        // estándar de Android). Casteamos a `any` para bypassear el tipo
        // y le pasamos el string literal que el SO entiende.
        const permName = 'android.permission.SCHEDULE_EXACT_ALARM';
        await (
          PermissionsAndroid as unknown as {
            request: (p: string) => Promise<string>;
          }
        ).request(permName);
      } catch (e) {
        // Si el device no soporta el permission (Android < 12 o custom
        // ROM que no lo expone), seguimos. Las alarmas se agendan igual,
        // pueden no sonar a la hora exacta por Doze.
        console.warn('[notifications] SCHEDULE_EXACT_ALARM no disponible:', e);
      }
    }

    return { ok: true, data: 'granted' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

// =============================================================================
// Agendar / cancelar alarmas
// =============================================================================

export interface ScheduleAlarmInput {
  servicioId: string;
  fechaInicioISO: string;
  offsetMinutos: number;
  tituloServicio: string;
  grupoNombre: string;
}

/**
 * Agenda una alarma local para un servicio. Devuelve el ID de la
 * notificación agendada (opaco, gestionado por expo-notifications).
 *
 * Si la fecha de la alarma ya pasó, no agenda nada y devuelve null.
 * Esto pasa cuando el usuario abre "Mi semana" y un servicio está
 * a menos de `offsetMinutos` de empezar.
 */
export async function scheduleAlarm(
  input: ScheduleAlarmInput,
): Promise<Result<string | null>> {
  try {
    const fechaInicio = new Date(input.fechaInicioISO);
    const fechaAlarma = new Date(fechaInicio.getTime() - input.offsetMinutos * 60_000);

    if (fechaAlarma.getTime() <= Date.now()) {
      return { ok: true, data: null };
    }

    const id = await Notifications.scheduleNotificationAsync({
      identifier: `alarm-${input.servicioId}`,
      content: {
        title: 'Servicio en 1 hora',
        body: `${input.tituloServicio} — ${input.grupoNombre}`,
        sound: 'default',
        interruptionLevel: 'timeSensitive',
        categoryIdentifier: CATEGORY_ID,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fechaAlarma,
      },
    });

    // Track local para cancelación selectiva
    const existing = alarmasPorServicio.get(input.servicioId) ?? [];
    existing.push(id);
    alarmasPorServicio.set(input.servicioId, existing);

    return { ok: true, data: id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Cancela todas las alarmas agendadas para un servicio. Llamar cuando
 * el admin edita el patrón y se re-generan servicios, o cuando se
 * cancela un servicio puntual.
 */
export async function cancelAlarmsDeServicio(servicioId: string): Promise<Result<number>> {
  try {
    const ids = alarmasPorServicio.get(servicioId) ?? [];
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
    alarmasPorServicio.delete(servicioId);
    return { ok: true, data: ids.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** Cancela TODAS las alarmas agendadas. Útil en signOut o en reset. */
export async function cancelAllAlarms(): Promise<Result<number>> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
    alarmasPorServicio.clear();
    return { ok: true, data: all.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
