/**
 * API de Asistencia contra Supabase.
 *
 * Cubre RF-090 (abrir pantalla), RF-091 (marcar), RF-092 (ver
 * justificaciones), RF-093 (cambiar a justificado), RF-094 (cerrar),
 * RF-095 (reabrir), RF-096 (miembro justifica), RF-097 (lectura).
 *
 * El RLS valida de vuelta quién puede UPDATE/INSERT (admin o
 * responsable del servicio concreto, vía helper
 * `usuario_puede_cerrar_servicio`). Para la auto-justificación del
 * miembro (RF-096), la RLS permite que cada uno escriba/edite la
 * propia.
 */
import { supabase } from '@/lib/supabase';
import { Result } from '@/lib/result';
import { mapErr, mapSupabaseError } from '@/lib/errores';

import {
  AsignacionConEstado,
  EstadoAsistencia,
  MiEstadoEnServicio,
  ResumenCierre,
} from './types';

/**
 * Normaliza una relación embebida de PostgREST: devuelve el primer elemento
 * si vino como array (to-many) o el objeto tal cual si vino to-one.
 */
function pickOne<T>(rel: unknown): T | null {
  if (rel == null) return null;
  return (Array.isArray(rel) ? (rel[0] ?? null) : rel) as T | null;
}

// =============================================================================
// Resumen de cierre (RF-090)
// =============================================================================

interface ResumenRow {
  id: string;
  titulo: string | null;
  fecha_inicio: string;
  lugar: string | null;
  estado: 'programado' | 'cancelado' | 'realizado';
  asistencia_cerrada: boolean;
  asistencia_cerrada_at: string | null;
  responsable: {
    id: string;
    nombre: string;
    apellido: string;
  } | null;
  cerrado_por: {
    nombre: string;
    apellido: string;
  } | null;
  asignaciones_servicio: Array<{
    id: string;
    usuario_grupo_id: string;
    rol_servicio: AsignacionConEstado['rol_servicio'];
    usuario_grupos: {
      usuario_id: string;
      perfiles: { nombre: string; apellido: string } | null;
    } | null;
    estados_asistencia_servicio: Array<{
      id: string;
      estado: EstadoAsistencia;
    }>;
    justificaciones_servicio: Array<{ texto: string }>;
  }>;
}

/**
 * Trae toda la info necesaria para la pantalla de cierre de un servicio.
 * Hace un JOIN anidado a asignaciones → estado + justificación.
 *
 * RLS: el SELECT lo deja pasar a todos los miembros del grupo (RF-097);
 * las mutations (UPDATE/INSERT) las valida la RLS de cada tabla.
 */
export async function obtenerResumenCierre(
  servicioId: string,
): Promise<Result<ResumenCierre>> {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .select(
        `
        id, titulo, fecha_inicio, lugar, estado, asistencia_cerrada, asistencia_cerrada_at,
        responsable:servicios_responsable_id_fkey (id, nombre, apellido),
        cerrado_por:perfiles!servicios_asistencia_cerrada_por_fkey (nombre, apellido),
        asignaciones_servicio!asignaciones_servicio_servicio_id_fkey (
          id, usuario_grupo_id, rol_servicio,
          usuario_grupos!asignaciones_servicio_usuario_grupo_id_fkey (
            usuario_id,
            perfiles!usuarios_grupos_usuario_id_fkey (nombre, apellido)
          ),
          estados_asistencia_servicio!estados_asistencia_servicio_asignacion_id_fkey (
            id, estado
          ),
          justificaciones_servicio!justificaciones_servicio_servicio_id_fkey (texto)
        )
      `,
      )
      .eq('id', servicioId)
      .maybeSingle<ResumenRow>();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    if (!data) return { ok: false, error: 'Servicio no encontrado' };

    const asignaciones: AsignacionConEstado[] = (data.asignaciones_servicio ?? [])
      .filter((a) => a.usuario_grupos?.perfiles)
      .map((a) => ({
        asignacion_id: a.id,
        usuario_grupo_id: a.usuario_grupo_id,
        rol_servicio: a.rol_servicio,
        estado: a.estados_asistencia_servicio?.[0]?.estado ?? 'asistio',
        estado_id: a.estados_asistencia_servicio?.[0]?.id ?? '',
        justificacion: a.justificaciones_servicio?.[0]?.texto ?? null,
        miembro: {
          usuario_id: a.usuario_grupos!.usuario_id,
          nombre: a.usuario_grupos!.perfiles!.nombre,
          apellido: a.usuario_grupos!.perfiles!.apellido,
        },
      }));

    return {
      ok: true,
      data: {
        servicio: {
          id: data.id,
          titulo: data.titulo,
          fecha_inicio: data.fecha_inicio,
          lugar: data.lugar,
          estado: data.estado,
          asistencia_cerrada: data.asistencia_cerrada,
          asistencia_cerrada_at: data.asistencia_cerrada_at,
          asistencia_cerrada_por_nombre: data.cerrado_por
            ? `${data.cerrado_por.nombre} ${data.cerrado_por.apellido}`
            : null,
        },
        responsable: data.responsable
          ? {
              usuario_id: data.responsable.id,
              nombre: data.responsable.nombre,
              apellido: data.responsable.apellido,
            }
          : null,
        asignaciones,
      },
    };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Mutations: cambiar estado de una asignación (RF-091, RF-093)
// =============================================================================

/**
 * Cambia el estado de asistencia de una asignación.
 * La RLS exige que el caller sea admin o responsable del servicio
 * (helper `usuario_puede_cerrar_servicio`).
 */
export async function actualizarEstadoAsistencia(input: {
  estado_id: string;
  nuevo_estado: EstadoAsistencia;
}): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('estados_asistencia_servicio')
      .update({ estado: input.nuevo_estado })
      .eq('id', input.estado_id)
      .select('id')
      .single();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Cerrar / reabrir asistencia (RF-094, RF-095)
// =============================================================================

/**
 * Cierra la asistencia de un servicio. La RLS valida que el caller
 * sea admin o responsable (helper `usuario_puede_cerrar_servicio`).
 * El trigger de la DB actualiza `asistencia_cerrada_por` con
 * `auth.uid()`.
 */
export async function cerrarAsistencia(
  servicioId: string,
): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .update({ asistencia_cerrada: true })
      .eq('id', servicioId)
      .select('id')
      .single();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/** Reabre un servicio cerrado. Solo admin del grupo (RF-095). */
export async function reabrirAsistencia(
  servicioId: string,
): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .update({ asistencia_cerrada: false })
      .eq('id', servicioId)
      .select('id')
      .single();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Estados del usuario actual en un batch de servicios (para mi-semana)
// =============================================================================

/**
 * Devuelve el estado de asistencia del usuario actual para cada
 * servicio del array de ids. Lo usa mi-semana para mostrar el CTA
 * "Justificar" en cada servicio donde el estado es no_asistio.
 */
export async function obtenerMisEstadosEnServicios(input: {
  servicioIds: string[];
}): Promise<
  Result<
    Map<
      string,
      {
        asignacion_id: string;
        estado: EstadoAsistencia;
        justificacion: string | null;
      }
    >
  >
> {
  if (input.servicioIds.length === 0) {
    return { ok: true, data: new Map() };
  }
  try {
    const { data, error } = await supabase
      .from('asignaciones_servicio')
      .select(
        `
        id, servicio_id,
        estados_asistencia_servicio!estados_asistencia_servicio_asignacion_id_fkey (id, estado),
        justificaciones_servicio!justificaciones_servicio_servicio_id_fkey (texto)
      `,
      )
      .in('servicio_id', input.servicioIds);

    if (error) return { ok: false, error: mapSupabaseError(error) };
    if (!data) return { ok: true, data: new Map() };

    const out = new Map<
      string,
      {
        asignacion_id: string;
        estado: EstadoAsistencia;
        justificacion: string | null;
      }
    >();

    for (const row of data) {
      // PostgREST devuelve la relación to-one como objeto y la to-many como
      // array. `pickOne` normaliza ambas formas (antes el `?.[0]` asumía
      // siempre array, y sobre la relación to-one daba undefined => bug).
      const estadoRow = pickOne<{ estado: EstadoAsistencia }>(
        row.estados_asistencia_servicio,
      );
      const justifRow = pickOne<{ texto: string }>(row.justificaciones_servicio);
      const estado = estadoRow?.estado ?? 'asistio';
      const justif = justifRow?.texto ?? null;
      out.set(row.servicio_id, {
        asignacion_id: row.id,
        estado,
        justificacion: justif,
      });
    }

    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Mi estado en un servicio (RF-096)
// =============================================================================

interface MiEstadoRow {
  id: string;
  servicio_id: string;
  servicios: {
    id: string;
    titulo: string | null;
    fecha_inicio: string;
  } | null;
  estados_asistencia_servicio: Array<{
    id: string;
    estado: EstadoAsistencia;
  }>;
  justificaciones_servicio: Array<{ texto: string }>;
}

/**
 * Devuelve el estado del usuario actual en un servicio concreto, junto
 * con su justificación (si tiene). Lo usa la pantalla "Justificar".
 */
export async function obtenerMiEstadoEnServicio(
  servicioId: string,
): Promise<Result<MiEstadoEnServicio>> {
  try {
    const { data: userData, error: errUser } = await supabase.auth.getUser();
    if (errUser || !userData.user) {
      return { ok: false, error: 'No hay sesión activa' };
    }

    const { data, error } = await supabase
      .from('asignaciones_servicio')
      .select(
        `
        id, servicio_id,
        servicios!asignaciones_servicio_servicio_id_fkey (id, titulo, fecha_inicio),
        estados_asistencia_servicio!estados_asistencia_servicio_asignacion_id_fkey (id, estado),
        justificaciones_servicio!justificaciones_servicio_servicio_id_fkey (texto)
      `,
      )
      .eq('servicio_id', servicioId)
      .returns<MiEstadoRow[]>();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    if (!data || data.length === 0) {
      return { ok: false, error: 'No estás asignado a este servicio' };
    }

    // Tomamos la primera asignación del usuario a este servicio
    // (puede haber varias si tiene múltiples roles)
    const a = data[0];
    const estado = a.estados_asistencia_servicio?.[0]?.estado ?? 'asistio';

    return {
      ok: true,
      data: {
        asignacion_id: a.id,
        estado,
        justificacion: a.justificaciones_servicio?.[0]?.texto ?? null,
        servicio: a.servicios ?? { id: servicioId, titulo: null, fecha_inicio: '' },
      },
    };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Justificación del miembro (RF-096)
// =============================================================================

/**
 * Guarda o actualiza la justificación de un miembro para un servicio.
 *
 * RLS: cada miembro puede INSERT/UPDATE solo su propia justificación
 * (policy "justificaciones: insertar/actualizar solo para mi mismo").
 * Como hay UNIQUE (servicio_id, usuario_grupo_id), si ya existe
 * hacemos UPDATE; si no, INSERT.
 */
export async function guardarJustificacion(input: {
  servicio_id: string;
  texto: string;
}): Promise<Result<{ id: string }>> {
  try {
    const { data: userData, error: errUser } = await supabase.auth.getUser();
    if (errUser || !userData.user) {
      return { ok: false, error: 'No hay sesión activa' };
    }

    // 1. Necesitamos el usuario_grupo_id del usuario en este grupo
    const { data: srv, error: errSrv } = await supabase
      .from('servicios')
      .select('grupo_id')
      .eq('id', input.servicio_id)
      .maybeSingle();

    if (errSrv) return { ok: false, error: mapSupabaseError(errSrv) };
    if (!srv) return { ok: false, error: 'Servicio no encontrado' };

    const { data: ug, error: errUg } = await supabase
      .from('usuarios_grupos')
      .select('id')
      .eq('grupo_id', srv.grupo_id)
      .eq('usuario_id', userData.user.id)
      .eq('estado', 'activo')
      .maybeSingle();

    if (errUg) return { ok: false, error: mapSupabaseError(errUg) };
    if (!ug) return { ok: false, error: 'No sos miembro activo de este grupo' };

    // 2. Buscar si ya existe una justificación
    const { data: existente } = await supabase
      .from('justificaciones_servicio')
      .select('id')
      .eq('servicio_id', input.servicio_id)
      .eq('usuario_grupo_id', ug.id)
      .maybeSingle();

    if (existente) {
      // UPDATE
      const { data, error } = await supabase
        .from('justificaciones_servicio')
        .update({ texto: input.texto.trim() })
        .eq('id', existente.id)
        .select('id')
        .single();
      if (error) return { ok: false, error: mapSupabaseError(error) };
      return { ok: true, data: { id: data.id } };
    } else {
      // INSERT
      const { data, error } = await supabase
        .from('justificaciones_servicio')
        .insert({
          servicio_id: input.servicio_id,
          usuario_grupo_id: ug.id,
          texto: input.texto.trim(),
        })
        .select('id')
        .single();
      if (error) return { ok: false, error: mapSupabaseError(error) };
      return { ok: true, data: { id: data.id } };
    }
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}
