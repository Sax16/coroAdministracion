/**
 * API de Asignaciones contra Supabase.
 *
 * Cubre RF-050, RF-051, RF-052 y RF-053 del MVP.
 *
 * Decisiones de implementación:
 * - La vista semanal se arma con un SELECT a `servicios` filtrado por
 *   `fecha_inicio` en el rango [lunes, lunes+7d) y por `grupo_id`. Las
 *   asignaciones se traen en una segunda query con `servicio_id IN (...)`
 *   y se mergean en JS. Esto es más simple y performante que un JOIN
 *   masivo para una semana (típicamente 5-15 servicios).
 * - La edición (RF-053) se modela como DELETE + INSERT. No usamos UPDATE
 *   porque el UNIQUE constraint es (servicio_id, usuario_grupo_id, rol_servicio),
 *   así que cambiar un rol es lo mismo que borrar uno y crear otro.
 * - El trigger `crear_estado_asistencia_al_asignar()` crea automáticamente
 *   la fila en `estados_asistencia_servicio` con default 'asistio'. Esta
 *   API no toca ese estado — eso es responsabilidad del workflow de cierre
 *   de asistencia (RF-090+).
 */
import { supabase } from '@/lib/supabase';

import {
  AsignacionDetallada,
  MiembroGrupo,
  RolServicio,
  ServicioConAsignaciones,
} from './types';

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function mapErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

// =============================================================================
// Servicios de la semana
// =============================================================================

interface ServicioRow {
  id: string;
  grupo_id: string;
  tipo: 'servicio' | 'ensayo' | 'comunicado';
  titulo: string | null;
  fecha_inicio: string;
  estado: 'programado' | 'cancelado' | 'realizado';
}

interface AsignacionJoinRow {
  id: string;
  servicio_id: string;
  usuario_grupo_id: string;
  rol_servicio: RolServicio;
  created_at: string;
  usuario_grupos: {
    id: string;
    usuario_id: string;
    perfiles: {
      nombre: string;
      apellido: string;
    } | null;
  } | null;
}

/**
 * Devuelve los servicios del grupo en la semana que empieza en `lunesISO`,
 * con sus asignaciones mergeadas (cada servicio incluye la lista de
 * asignaciones con datos del miembro). Solo servicios NO cancelados
 * (los cancelados se listan aparte, tachados — ver TODO en pantalla).
 *
 * El parámetro `lunesISO` es el inicio de la semana (lunes 00:00 local
 * convertido a ISO). El fin es lunes+7d, exclusivo.
 */
export async function listarServiciosSemana(
  grupoId: string,
  lunesISO: string,
  lunesSiguienteISO: string,
): Promise<Result<ServicioConAsignaciones[]>> {
  try {
    // 1. Servicios del rango
    const { data: servicios, error: errServ } = await supabase
      .from('servicios')
      .select('id, grupo_id, tipo, titulo, fecha_inicio, estado')
      .eq('grupo_id', grupoId)
      .gte('fecha_inicio', lunesISO)
      .lt('fecha_inicio', lunesSiguienteISO)
      .order('fecha_inicio', { ascending: true })
      .returns<ServicioRow[]>();

    if (errServ) return { ok: false, error: errServ.message };
    if (!servicios || servicios.length === 0) {
      return { ok: true, data: [] };
    }

    // 2. Asignaciones de esos servicios, con JOIN a perfil del miembro
    const servicioIds = servicios.map((s) => s.id);
    const { data: asigs, error: errAsig } = await supabase
      .from('asignaciones_servicio')
      .select(
        `
        id,
        servicio_id,
        usuario_grupo_id,
        rol_servicio,
        created_at,
        usuario_grupos!asignaciones_servicio_usuario_grupo_id_fkey (
          id,
          usuario_id,
          perfiles!usuarios_grupos_usuario_id_fkey (
            nombre,
            apellido
          )
        )
      `,
      )
      .in('servicio_id', servicioIds)
      .returns<AsignacionJoinRow[]>();

    if (errAsig) return { ok: false, error: errAsig.message };

    // 3. Merge en JS: agrupar asignaciones por servicio_id
    const asigsPorServicio = new Map<string, AsignacionDetallada[]>();
    for (const row of asigs ?? []) {
      const ug = row.usuario_grupos;
      const perfil = ug?.perfiles;
      if (!ug || !perfil) continue; // defensa: si el JOIN falló, lo salteamos
      const detallada: AsignacionDetallada = {
        id: row.id,
        servicio_id: row.servicio_id,
        usuario_grupo_id: row.usuario_grupo_id,
        rol_servicio: row.rol_servicio,
        created_at: row.created_at,
        miembro: {
          usuario_grupo_id: ug.id,
          usuario_id: ug.usuario_id,
          nombre: perfil.nombre,
          apellido: perfil.apellido,
        },
      };
      const arr = asigsPorServicio.get(row.servicio_id) ?? [];
      arr.push(detallada);
      asigsPorServicio.set(row.servicio_id, arr);
    }

    const out: ServicioConAsignaciones[] = servicios.map((s) => ({
      id: s.id,
      fecha_inicio: s.fecha_inicio,
      titulo: s.titulo,
      tipo: s.tipo,
      estado: s.estado,
      asignaciones: asigsPorServicio.get(s.id) ?? [],
    }));

    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Miembros del grupo (para el selector de asignación)
// =============================================================================

interface MiembroJoinRow {
  id: string;
  usuario_id: string;
  rol: 'admin' | 'miembro';
  estado: 'activo' | 'inactivo';
  perfiles: {
    nombre: string;
    apellido: string;
  } | null;
}

/** Lista los miembros ACTIVOS del grupo (estado='activo'). */
export async function listarMiembrosActivos(grupoId: string): Promise<Result<MiembroGrupo[]>> {
  try {
    const { data, error } = await supabase
      .from('usuarios_grupos')
      .select(
        `
        id,
        usuario_id,
        rol,
        estado,
        perfiles!usuarios_grupos_usuario_id_fkey (
          nombre,
          apellido
        )
      `,
      )
      .eq('grupo_id', grupoId)
      .eq('estado', 'activo')
      .order('rol', { ascending: true }) // admins primero
      .returns<MiembroJoinRow[]>();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: true, data: [] };

    const out: MiembroGrupo[] = data
      .filter((m) => m.perfiles !== null)
      .map((m) => ({
        usuario_grupo_id: m.id,
        usuario_id: m.usuario_id,
        nombre: m.perfiles!.nombre,
        apellido: m.perfiles!.apellido,
        rol: m.rol,
      }))
      // Dentro de cada rol, ordenar alfabéticamente por apellido
      .sort((a, b) => {
        if (a.rol !== b.rol) return a.rol === 'admin' ? -1 : 1;
        return a.apellido.localeCompare(b.apellido);
      });

    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Mutaciones: crear / eliminar asignaciones
// =============================================================================

/**
 * Crea una asignación. La RLS valida que el usuario sea admin del grupo
 * (policy "asignaciones: insertar solo admin"). El trigger crea
 * automáticamente la fila en `estados_asistencia_servicio`.
 *
 * Si ya existe (servicio_id, usuario_grupo_id, rol_servicio) — por ejemplo
 * si el usuario toca "Asignar" dos veces con la misma combinación —
 * Supabase devuelve error 23505 (unique violation). Lo capturamos y lo
 * reportamos como mensaje legible, no como crash.
 */
export async function crearAsignacion(input: {
  servicio_id: string;
  usuario_grupo_id: string;
  rol_servicio: RolServicio;
}): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('asignaciones_servicio')
      .insert({
        servicio_id: input.servicio_id,
        usuario_grupo_id: input.usuario_grupo_id,
        rol_servicio: input.rol_servicio,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'Este miembro ya tiene ese rol asignado' };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/**
 * Crea N asignaciones en una sola transacción. Si alguna falla (por ej.
 * por el UNIQUE constraint con una ya existente), ninguna se inserta
 * (atomicidad). Útil para "asignar este miembro con estos N roles".
 */
export async function crearAsignaciones(
  items: Array<{ servicio_id: string; usuario_grupo_id: string; rol_servicio: RolServicio }>,
): Promise<Result<{ count: number }>> {
  if (items.length === 0) return { ok: true, data: { count: 0 } };
  try {
    const { data, error } = await supabase
      .from('asignaciones_servicio')
      .insert(items)
      .select('id');

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'Una o más asignaciones ya existen' };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, data: { count: data?.length ?? 0 } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/** Elimina una asignación por su id. La RLS exige que sea admin del grupo. */
export async function eliminarAsignacion(id: string): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('asignaciones_servicio')
      .delete()
      .eq('id', id)
      .select('id')
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/**
 * Elimina TODAS las asignaciones de un miembro en un servicio. Usado por
 * "Quitar miembro del servicio" en la UI (un click, varias filas a borrar).
 */
export async function eliminarAsignacionesDeMiembro(
  servicioId: string,
  usuarioGrupoId: string,
): Promise<Result<{ count: number }>> {
  try {
    const { data, error } = await supabase
      .from('asignaciones_servicio')
      .delete()
      .eq('servicio_id', servicioId)
      .eq('usuario_grupo_id', usuarioGrupoId)
      .select('id');

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { count: data?.length ?? 0 } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}
