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
import { Result } from '@/lib/result';
import { mapErr, mapSupabaseError } from '@/lib/errores';

import {
  AsignacionDetallada,
  MiembroGrupo,
  RolServicio,
  ServicioConAsignaciones,
} from './types';

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

interface AsignacionRow {
  id: string;
  servicio_id: string;
  usuario_grupo_id: string;
  rol_servicio: RolServicio;
  created_at: string;
}

interface UsuarioGrupoRow {
  id: string;
  usuario_id: string;
}

interface PerfilRow {
  id: string;
  nombre: string;
  apellido: string;
}

/**
 * Devuelve los servicios del grupo en la semana que empieza en `lunesISO`,
 * con sus asignaciones mergeadas (cada servicio incluye la lista de
 * asignaciones con datos del miembro). Solo servicios NO cancelados
 * (los cancelados se listan aparte, tachados — ver TODO en pantalla).
 *
 * Implementación: 3 queries separadas en lugar de un JOIN embebido.
 * Esto es más robusto porque NO depende del schema cache de PostgREST
 * para reconocer foreign keys embebidas — vimos que ese cache puede
 * quedar stale y romper el embed con "Could not find a relationship".
 * Tradeoff: 3 round-trips a Supabase en vez de 1, pero el volumen de
 * datos de la vista semanal es chico (decenas de servicios, no miles).
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

    if (errServ) return { ok: false, error: mapSupabaseError(errServ) };
    if (!servicios || servicios.length === 0) {
      return { ok: true, data: [] };
    }

    const servicioIds = servicios.map((s) => s.id);

    // 2. Asignaciones de esos servicios (sin JOIN — los mergeamos en JS)
    const { data: asigs, error: errAsig } = await supabase
      .from('asignaciones_servicio')
      .select('id, servicio_id, usuario_grupo_id, rol_servicio, created_at')
      .in('servicio_id', servicioIds)
      .returns<AsignacionRow[]>();

    if (errAsig) return { ok: false, error: mapSupabaseError(errAsig) };

    // Si no hay asignaciones, devolvemos servicios con lista vacía
    if (!asigs || asigs.length === 0) {
      const out: ServicioConAsignaciones[] = servicios.map((s) => ({
        id: s.id,
        fecha_inicio: s.fecha_inicio,
        titulo: s.titulo,
        tipo: s.tipo,
        estado: s.estado,
        asignaciones: [],
      }));
      return { ok: true, data: out };
    }

    // 3. Lookup de usuarios_grupos (los que aparecen en las asignaciones)
    const ugIds = Array.from(new Set(asigs.map((a) => a.usuario_grupo_id)));
    const { data: ugs, error: errUg } = await supabase
      .from('usuarios_grupos')
      .select('id, usuario_id')
      .in('id', ugIds)
      .returns<UsuarioGrupoRow[]>();

    if (errUg) return { ok: false, error: mapSupabaseError(errUg) };
    const ugMap = new Map<string, UsuarioGrupoRow>();
    for (const ug of ugs ?? []) ugMap.set(ug.id, ug);

    // 4. Lookup de perfiles (los usuarios detrás de los usuarios_grupos)
    const usuarioIds = Array.from(
      new Set((ugs ?? []).map((ug) => ug.usuario_id)),
    );
    const { data: perfiles, error: errPer } = await supabase
      .from('perfiles')
      .select('id, nombre, apellido')
      .in('id', usuarioIds)
      .returns<PerfilRow[]>();

    if (errPer) return { ok: false, error: mapSupabaseError(errPer) };
    const perfilMap = new Map<string, PerfilRow>();
    for (const p of perfiles ?? []) perfilMap.set(p.id, p);

    // 5. Merge en JS: agrupar asignaciones por servicio_id con datos del miembro
    const asigsPorServicio = new Map<string, AsignacionDetallada[]>();
    for (const a of asigs) {
      const ug = ugMap.get(a.usuario_grupo_id);
      if (!ug) continue;
      const perfil = perfilMap.get(ug.usuario_id);
      if (!perfil) continue; // defensa: si el perfil fue borrado, lo salteamos
      const detallada: AsignacionDetallada = {
        id: a.id,
        servicio_id: a.servicio_id,
        usuario_grupo_id: a.usuario_grupo_id,
        rol_servicio: a.rol_servicio,
        created_at: a.created_at,
        miembro: {
          usuario_grupo_id: ug.id,
          usuario_id: ug.usuario_id,
          nombre: perfil.nombre,
          apellido: perfil.apellido,
        },
      };
      const arr = asigsPorServicio.get(a.servicio_id) ?? [];
      arr.push(detallada);
      asigsPorServicio.set(a.servicio_id, arr);
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

interface MiembroRow {
  id: string;
  usuario_id: string;
  rol: 'admin' | 'miembro';
  estado: 'activo' | 'inactivo';
}

/** Lista los miembros ACTIVOS del grupo (estado='activo'). */
export async function listarMiembrosActivos(grupoId: string): Promise<Result<MiembroGrupo[]>> {
  try {
    // 1. usuarios_grupos del grupo
    const { data: miembros, error: errUg } = await supabase
      .from('usuarios_grupos')
      .select('id, usuario_id, rol, estado')
      .eq('grupo_id', grupoId)
      .eq('estado', 'activo')
      .order('rol', { ascending: true }) // admins primero
      .returns<MiembroRow[]>();

    if (errUg) return { ok: false, error: mapSupabaseError(errUg) };
    if (!miembros || miembros.length === 0) {
      return { ok: true, data: [] };
    }

    // 2. perfiles de esos usuarios (sin JOIN embebido — ver listarServiciosSemana)
    const usuarioIds = Array.from(new Set(miembros.map((m) => m.usuario_id)));
    const { data: perfiles, error: errPer } = await supabase
      .from('perfiles')
      .select('id, nombre, apellido')
      .in('id', usuarioIds)
      .returns<PerfilRow[]>();

    if (errPer) return { ok: false, error: mapSupabaseError(errPer) };
    const perfilMap = new Map<string, PerfilRow>();
    for (const p of perfiles ?? []) perfilMap.set(p.id, p);

    const out: MiembroGrupo[] = miembros
      .map((m): MiembroGrupo | null => {
        const perfil = perfilMap.get(m.usuario_id);
        if (!perfil) return null;
        return {
          usuario_grupo_id: m.id,
          usuario_id: m.usuario_id,
          nombre: perfil.nombre,
          apellido: perfil.apellido,
          rol: m.rol,
        };
      })
      // Filtrar miembros sin perfil (defensa)
      .filter((m): m is MiembroGrupo => m !== null)
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
      return { ok: false, error: mapSupabaseError(error) };
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
      return { ok: false, error: mapSupabaseError(error) };
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

    if (error) return { ok: false, error: mapSupabaseError(error) };
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

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { count: data?.length ?? 0 } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}
