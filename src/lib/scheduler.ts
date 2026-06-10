/**
 * Programador de alarmas locales para servicios.
 *
 * Se invoca al renderizar la pantalla "Mi semana" (cuando el usuario
 * ve sus asignaciones). Agenda una alarma `alarm` por cada asignación
 * futura, con un offset en minutos (default 60) configurable en el
 * patrón recurrente del grupo.
 *
 * Por qué esto y no un setInterval:
 * - Doze en Android mata loops en background.
 * - Una librería de despertador real requiere foreground service y
 *   tiene bugs en OEMs (Samsung, Xiaomi).
 * - El SO agenda la alarma de forma nativa (como un despertador) sin
 *   que la app esté corriendo. Cero impacto en batería.
 *
 * TODO (post-bootstrap):
 * - Implementar `scheduleAlarmForService(asignacion, offsetMinutos)`.
 * - Implementar `cancelAllLocalAlarms()` al cerrar sesión o cambiar de grupo.
 */
import * as Notifications from 'expo-notifications';

import { LOCAL_ALARM_CATEGORY } from './notifications';

export interface ServicioParaAlarma {
  id: string;
  titulo: string;
  lugar?: string;
  fechaInicio: Date;
}

export interface AsignacionParaAlarma {
  id: string;
  servicio: ServicioParaAlarma;
  rol: 'cantante' | 'musico' | 'limpieza';
}

export async function scheduleAlarmForService(
  asignacion: AsignacionParaAlarma,
  offsetMinutos = 60,
): Promise<string | null> {
  const fechaAlarma = new Date(
    asignacion.servicio.fechaInicio.getTime() - offsetMinutos * 60_000,
  );

  if (fechaAlarma <= new Date()) {
    return null; // ya pasó, no agendamos
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Servicio en ${offsetMinutos} min`,
      body: `${asignacion.servicio.titulo}${
        asignacion.servicio.lugar ? ` — ${asignacion.servicio.lugar}` : ''
      }`,
      sound: 'alarm.wav',
      interruptionLevel: 'timeSensitive',
      categoryIdentifier: LOCAL_ALARM_CATEGORY,
    },
    trigger: { type: 'date', date: fechaAlarma } as Notifications.DateTriggerInput,
  });

  return identifier;
}

export async function cancelAllLocalAlarms(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
