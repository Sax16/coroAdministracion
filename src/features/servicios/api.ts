/**
 * API de Servicios contra Supabase.
 *
 * Cubre RF-042 y RF-043 del MVP. RF-042 (cancelar servicio puntual) y
 * RF-043 (crear servicio excepcional) usan UPDATE/INSERT directo en
 * `public.servicios`. La RLS de la tabla exige que el caller sea admin
 * del grupo (policy "servicios: insertar solo admin" / "servicios:
 * actualizar solo admin") — no hace falta SECURITY DEFINER functions.
 *
 * Decisiones:
 * - Los servicios pueden venir del patrón recurrente (RF-040) o ser
 *   excepcionales (RF-043, patron_id = NULL). Esta API no diferencia:
 *   el caller pasa los campos que quiere setear.
 * - El campo `lugar`, `descripcion` y `notas_canciones` son opcionales
 *   en la DB (nullable). Los mandamos como `null` si el form los deja
 *   vacíos, para no pisar valores existentes con string vacío.
 */
import { supabase } from '@/lib/supabase';

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function mapErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export interface ServicioCancelado {
  id: string;
  estado: 'cancelado';
}

/**
 * Marca un servicio como cancelado (RF-042).
 *
 * Implementación: UPDATE directo a `public.servicios` filtrado por
 * `id = servicioId`, seteando `estado = 'cancelado'`. La RLS
 * "servicios: actualizar solo admin" exige que el caller sea admin
 * del grupo al que pertenece el servicio.
 *
 * **Importante — no se borran asignaciones.** El RF-042 dice:
 * "Las asignaciones se mantienen en el historial pero el servicio
 * queda en estado `cancelado`." Las asignaciones siguen existiendo
 * en la DB — la UI las ignora con el filtro `estado != 'cancelado'`
 * y los miembros ven el servicio tachado en la vista semanal.
 *
 * **Push:** la spec dice "los asignados reciben push". En esta v0.1.0
 * el push NO se dispara desde acá — el sistema de push vive en otro
 * feature (RF-062) y se cablea por trigger o por un edge function en
 * v0.2.0. Para la beta se documenta como gap de RF-062.
 */
export async function cancelarServicio(servicioId: string): Promise<Result<ServicioCancelado>> {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .update({ estado: 'cancelado' })
      .eq('id', servicioId)
      .select('id, estado')
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'No se pudo cancelar el servicio' };
    if (data.estado !== 'cancelado') {
      return { ok: false, error: 'La DB no confirmó el estado cancelado' };
    }

    return { ok: true, data: { id: data.id, estado: 'cancelado' } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

export interface CrearServicioExcepcionalInput {
  grupoId: string;
  titulo: string;
  fechaInicio: string; // ISO timestamptz
  lugar?: string | null;
  descripcion?: string | null;
}

export interface ServicioCreado {
  id: string;
  titulo: string | null;
  fecha_inicio: string;
}

/**
 * Crea un servicio excepcional, fuera del patrón recurrente (RF-043).
 *
 * Implementación: INSERT directo a `public.servicios` con
 * `patron_id = NULL` (los servicios del patrón lo tienen seteado al
 * id del `patrones_recurrentes` que los generó; los excepcionales
 * nacen sin patrón). El resto de campos quedan en default:
 * `estado = 'programado'`, `tipo = 'servicio'`, etc.
 *
 * La RLS "servicios: insertar solo admin" exige que el caller sea
 * admin del grupo.
 *
 * **Sobre `fecha_inicio`:** la DB lo guarda como timestamptz UTC.
 * El form lo arma con `new Date(año, mes, dia, hora, 0)` en hora
 * local del dispositivo, que `toISOString()` convierte a UTC. El
 * display lo formatea de vuelta a local con `formatearHora()`.
 *
 * **Validaciones cliente (recomendadas en el form, la DB las enforcea):**
 * - `titulo` no vacío, max 120 chars.
 * - `fechaInicio` no en el pasado (con margen: >= hoy).
 */
export async function crearServicioExcepcional(
  input: CrearServicioExcepcionalInput,
): Promise<Result<ServicioCreado>> {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .insert({
        grupo_id: input.grupoId,
        tipo: 'servicio',
        titulo: input.titulo.trim(),
        fecha_inicio: input.fechaInicio,
        lugar: input.lugar?.trim() || null,
        descripcion: input.descripcion?.trim() || null,
        patron_id: null,
      })
      .select('id, titulo, fecha_inicio')
      .single();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'La DB no devolvió el servicio creado' };

    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}
