/**
 * Utility para llamar a la Edge Function `notificar-push` desde la app.
 *
 * Esta función NO se ejecuta del lado de la app — la app le pasa el
 * evento y la Edge Function hace el resto (resuelve destinatarios,
 * lee tokens, llama a Expo Push API, guarda historial).
 *
 * Uso:
 * ```ts
 * import { notificarPush } from '@/lib/pushApi';
 *
 * // Después de crear un servicio
 * await notificarPush('servicio_creado', {
 *   grupo_id: grupo.id,
 *   servicio_id: servicio.id,
 *   titulo: servicio.titulo,
 *   fecha_inicio: servicio.fecha_inicio,
 *   lugar: servicio.lugar,
 * });
 * ```
 *
 * La función es best-effort: si falla (timeout, red, error de la
 * Edge Function), la mutación original NO se revierte. Push es
 * secundario — el alta del servicio es lo principal. Si el caller
 * quiere esperar la confirmación, puede chequear `result.ok`.
 *
 * Decisión de implementación: en MVP, la app llama a la Edge Function
 * con el cliente Supabase normal (anon key + JWT del usuario). La
 * Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` internamente para
 * bypassear RLS y consultar destinatarios.
 */
import { supabase } from '@/lib/supabase';
import { Result } from '@/lib/result';

export type TipoNotificacion =
  | 'servicio_creado'
  | 'servicio_modificado'
  | 'servicio_cancelado'
  | 'ensayo_creado'
  | 'ensayo_modificado'
  | 'ensayo_cancelado'
  | 'comunicado_publicado'
  | 'solicitud_recibida'
  | 'solicitud_aprobada'
  | 'solicitud_rechazada'
  | 'asignacion_nueva';

export interface NotificarPushInput {
  tipo: TipoNotificacion;
  payload: Record<string, unknown>;
}

export interface NotificarPushResult {
  destinatarios: number;
  enviados: number;
  errores: number;
}

/**
 * Llama a la Edge Function `notificar-push`. Devuelve un Result con
 * estadísticas de envío o un error.
 *
 * NO bloquea: si la función tarda o falla, la app sigue. La mutación
 * original (insertar servicio, etc.) ya se hizo antes.
 */
export async function notificarPush(
  tipo: TipoNotificacion,
  payload: Record<string, unknown>,
): Promise<Result<NotificarPushResult>> {
  try {
    const { data, error } = await supabase.functions.invoke<NotificarPushResult>(
      'notificar-push',
      {
        body: { tipo, payload } as NotificarPushInput,
      },
    );

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data) {
      return { ok: true, data: { destinatarios: 0, enviados: 0, errores: 0 } };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
