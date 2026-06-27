/**
 * API de Solicitudes contra Supabase.
 *
 * Cubre RF-020 (crear solicitud), RF-021 (listar pendientes del admin),
 * RF-022 (aprobar), RF-023 (rechazar), RF-065/RF-066 (push — disparado
 * desde la app cliente después de la mutación).
 *
 * Decisiones:
 * - Aprobar usa la SECURITY DEFINER function `aprobar_solicitud(uuid)`.
 * - Rechazar hace UPDATE directo: la RLS permite a admin del grupo
 *   actualizar la solicitud. No hay function `rechazar_solicitud`
 *   porque no es multi-tabla: solo cambia un campo.
 * - El partial unique index `uq_solicitud_pendiente` (en
 *   grupo_id, usuario_id) WHERE estado='pendiente' impide duplicados.
 *   Capturamos 23505 y lo traducimos a mensaje legible.
 * - La búsqueda de grupos (RF-020) usa la nueva policy que permite
 *   SELECT a cualquier autenticado para grupos activos. La app
 *   proyecta solo id, nombre, descripcion (campos seguros).
 */
import { supabase } from '@/lib/supabase';
import { Result } from '@/lib/result';
import { mapErr, mapSupabaseError } from '@/lib/errores';

import {
  CrearSolicitudInput,
  GrupoDescubierto,
  SolicitudDetallada,
} from './types';

// =============================================================================
// Búsqueda de grupos (RF-020)
// =============================================================================

interface GrupoRow {
  id: string;
  nombre: string;
  descripcion: string | null;
}

/**
 * Busca grupos activos (no soft-deleted) por nombre (ilike %query%).
 * Devuelve también si el usuario actual ya es miembro activo, para
 * filtrar visualmente y no permitirle solicitar ingreso a un grupo
 * del que ya es parte.
 *
 * NOTA de seguridad: la query selecciona SOLO id, nombre, descripcion.
 * La policy permite SELECT de la fila completa, pero la app es
 * cuidadosa de no proyectar admin_id, zona_horaria u otros campos
 * sensibles en esta vista.
 */
export async function buscarGrupos(query: string): Promise<Result<GrupoDescubierto[]>> {
  try {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { ok: true, data: [] };
    }

    // 1. Traer grupos que matchean el query
    const { data: grupos, error: errGrupos } = await supabase
      .from('grupos')
      .select('id, nombre, descripcion')
      .is('deleted_at', null)
      .ilike('nombre', `%${trimmed}%`)
      .limit(20)
      .returns<GrupoRow[]>();

    if (errGrupos) return { ok: false, error: mapSupabaseError(errGrupos) };
    if (!grupos || grupos.length === 0) {
      return { ok: true, data: [] };
    }

    // 2. Traer la membresía del usuario actual
    const grupoIds = grupos.map((g) => g.id);
    const { data: ug, error: errUg } = await supabase
      .from('usuarios_grupos')
      .select('grupo_id')
      .in('grupo_id', grupoIds)
      .eq('estado', 'activo');

    if (errUg) return { ok: false, error: mapSupabaseError(errUg) };
    const miembrosActivos = new Set((ug ?? []).map((r) => r.grupo_id));

    // 3. Traer solicitudes pendientes del usuario actual
    const { data: sols, error: errSols } = await supabase
      .from('solicitudes_grupo')
      .select('grupo_id')
      .in('grupo_id', grupoIds)
      .eq('estado', 'pendiente');

    if (errSols) return { ok: false, error: mapSupabaseError(errSols) };
    const pendienteSet = new Set((sols ?? []).map((r) => r.grupo_id));

    // 4. Combinar
    const out: GrupoDescubierto[] = grupos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      descripcion: g.descripcion,
      ya_es_miembro: miembrosActivos.has(g.id) || pendienteSet.has(g.id),
    }));

    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Crear solicitud (RF-020)
// =============================================================================

/**
 * Crea una solicitud de ingreso. La RLS valida que `usuario_id` sea
 * el usuario actual. El partial unique index `uq_solicitud_pendiente`
 * impide duplicados.
 */
export async function crearSolicitud(
  input: CrearSolicitudInput,
): Promise<Result<{ id: string }>> {
  try {
    const { data: userData, error: errUser } = await supabase.auth.getUser();
    if (errUser || !userData.user) {
      return { ok: false, error: 'No hay sesión activa' };
    }

    const { data, error } = await supabase
      .from('solicitudes_grupo')
      .insert({
        grupo_id: input.grupo_id,
        usuario_id: userData.user.id,
        mensaje: input.mensaje?.trim() || null,
        estado: 'pendiente',
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'Ya tenés una solicitud pendiente para este grupo' };
      }
      return { ok: false, error: mapSupabaseError(error) };
    }
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Listados
// =============================================================================

interface SolicitudRow {
  id: string;
  grupo_id: string;
  usuario_id: string;
  mensaje: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  respondida_por: string | null;
  created_at: string;
  respondida_at: string | null;
  grupo: { id: string; nombre: string } | null;
  solicitante_perfil: {
    nombre: string;
    apellido: string;
    email: string;
  } | null;
  respondida_por_perfil: {
    nombre: string;
    apellido: string;
  } | null;
}

/**
 * Lista las solicitudes PENDIENTES de un grupo (RF-021). El admin las
 * ve en su inbox. JOIN al perfil del solicitante para mostrar nombre.
 */
export async function listarSolicitudesPendientes(
  grupoId: string,
): Promise<Result<SolicitudDetallada[]>> {
  try {
    const { data, error } = await supabase
      .from('solicitudes_grupo')
      .select(
        `
        id, grupo_id, usuario_id, mensaje, estado, respondida_por, created_at, respondida_at,
        grupo:grupos!solicitudes_grupo_grupo_id_fkey (id, nombre),
        solicitante_perfil:perfiles!solicitudes_grupo_usuario_id_fkey (nombre, apellido, email),
        respondida_por_perfil:perfiles!solicitudes_grupo_respondida_por_fkey (nombre, apellido)
      `,
      )
      .eq('grupo_id', grupoId)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true })
      .returns<SolicitudRow[]>();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    if (!data) return { ok: true, data: [] };

    const out: SolicitudDetallada[] = data
      .filter((r) => r.grupo && r.solicitante_perfil)
      .map((r) => ({
        id: r.id,
        grupo_id: r.grupo_id,
        usuario_id: r.usuario_id,
        mensaje: r.mensaje,
        estado: r.estado,
        respondida_por: r.respondida_por,
        created_at: r.created_at,
        respondida_at: r.respondida_at,
        grupo: {
          id: r.grupo!.id,
          nombre: r.grupo!.nombre,
        },
        solicitante: {
          usuario_id: r.usuario_id,
          nombre: r.solicitante_perfil!.nombre,
          apellido: r.solicitante_perfil!.apellido,
          email: r.solicitante_perfil!.email,
        },
        respondida_por_nombre: r.respondida_por_perfil
          ? `${r.respondida_por_perfil.nombre} ${r.respondida_por_perfil.apellido}`
          : null,
      }));

    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/**
 * Lista las solicitudes PENDIENTES del usuario actual, en todos los
 * grupos (para mostrar en su perfil "Mis solicitudes"). El usuario
 * no es admin de esos grupos — es el solicitante.
 */
export async function listarMisSolicitudesPendientes(): Promise<
  Result<SolicitudDetallada[]>
> {
  try {
    const { data: userData, error: errUser } = await supabase.auth.getUser();
    if (errUser || !userData.user) {
      return { ok: false, error: 'No hay sesión activa' };
    }

    const { data, error } = await supabase
      .from('solicitudes_grupo')
      .select(
        `
        id, grupo_id, usuario_id, mensaje, estado, respondida_por, created_at, respondida_at,
        grupo:grupos!solicitudes_grupo_grupo_id_fkey (id, nombre),
        solicitante_perfil:perfiles!solicitudes_grupo_usuario_id_fkey (nombre, apellido, email),
        respondida_por_perfil:perfiles!solicitudes_grupo_respondida_por_fkey (nombre, apellido)
      `,
      )
      .eq('usuario_id', userData.user.id)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .returns<SolicitudRow[]>();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    if (!data) return { ok: true, data: [] };

    const out: SolicitudDetallada[] = data
      .filter((r) => r.grupo && r.solicitante_perfil)
      .map((r) => ({
        id: r.id,
        grupo_id: r.grupo_id,
        usuario_id: r.usuario_id,
        mensaje: r.mensaje,
        estado: r.estado,
        respondida_por: r.respondida_por,
        created_at: r.created_at,
        respondida_at: r.respondida_at,
        grupo: {
          id: r.grupo!.id,
          nombre: r.grupo!.nombre,
        },
        solicitante: {
          usuario_id: r.usuario_id,
          nombre: r.solicitante_perfil!.nombre,
          apellido: r.solicitante_perfil!.apellido,
          email: r.solicitante_perfil!.email,
        },
        respondida_por_nombre: r.respondida_por_perfil
          ? `${r.respondida_por_perfil.nombre} ${r.respondida_por_perfil.apellido}`
          : null,
      }));

    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/** Trae una solicitud por id. */
export async function obtenerSolicitud(
  solicitudId: string,
): Promise<Result<SolicitudDetallada>> {
  try {
    const { data, error } = await supabase
      .from('solicitudes_grupo')
      .select(
        `
        id, grupo_id, usuario_id, mensaje, estado, respondida_por, created_at, respondida_at,
        grupo:grupos!solicitudes_grupo_grupo_id_fkey (id, nombre),
        solicitante_perfil:perfiles!solicitudes_grupo_usuario_id_fkey (nombre, apellido, email),
        respondida_por_perfil:perfiles!solicitudes_grupo_respondida_por_fkey (nombre, apellido)
      `,
      )
      .eq('id', solicitudId)
      .maybeSingle<SolicitudRow>();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    if (!data || !data.grupo || !data.solicitante_perfil) {
      return { ok: false, error: 'Solicitud no encontrada' };
    }

    return {
      ok: true,
      data: {
        id: data.id,
        grupo_id: data.grupo_id,
        usuario_id: data.usuario_id,
        mensaje: data.mensaje,
        estado: data.estado,
        respondida_por: data.respondida_por,
        created_at: data.created_at,
        respondida_at: data.respondida_at,
        grupo: {
          id: data.grupo.id,
          nombre: data.grupo.nombre,
        },
        solicitante: {
          usuario_id: data.usuario_id,
          nombre: data.solicitante_perfil.nombre,
          apellido: data.solicitante_perfil.apellido,
          email: data.solicitante_perfil.email,
        },
        respondida_por_nombre: data.respondida_por_perfil
          ? `${data.respondida_por_perfil.nombre} ${data.respondida_por_perfil.apellido}`
          : null,
      },
    };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Aprobar (RF-022) / Rechazar (RF-023)
// =============================================================================

/**
 * Aprueba una solicitud via la SECURITY DEFINER function. Crea el
 * `usuarios_grupos` con estado='activo' y marca la solicitud como
 * aprobada, todo en una transacción.
 */
export async function aprobarSolicitud(solicitudId: string): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('aprobar_solicitud', {
      p_solicitud_id: solicitudId,
    });
    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/**
 * Rechaza una solicitud via UPDATE directo. La RLS permite a admin
 * del grupo hacer UPDATE.
 */
export async function rechazarSolicitud(solicitudId: string): Promise<Result<null>> {
  try {
    const { error } = await supabase
      .from('solicitudes_grupo')
      .update({
        estado: 'rechazada',
        respondida_at: new Date().toISOString(),
      })
      .eq('id', solicitudId);

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}
