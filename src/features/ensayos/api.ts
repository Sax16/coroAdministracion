/**
 * API de Ensayos contra Supabase.
 *
 * Cubre RF-070 (crear), RF-071 (asignar encargado), RF-072 (editar),
 * RF-073 (cancelar), RF-074 (listar), RF-076 (push).
 *
 * El cierre de asistencia (RF-075) queda para v0.2.0 — esta API NO
 * toca `asistencias_ensayo`. Solo inserta invitaciones y deja que la
 * vista de cierre (v0.2.0) haga el UPDATE correspondiente.
 */
import { supabase } from '@/lib/supabase';
import { Result } from '@/lib/result';
import { mapErr, mapSupabaseError } from '@/lib/errores';
import { TablesUpdate } from '@/types/database.types';

import {
  CrearEnsayoInput,
  EditarEnsayoInput,
  Ensayo,
  EnsayoConEncargado,
  EstadoEnsayo,
  InvitadoEnsayoDetallado,
} from './types';

// =============================================================================
// Listados
// =============================================================================

interface EnsayoRow {
  id: string;
  grupo_id: string;
  titulo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  lugar: string | null;
  descripcion: string | null;
  tema: string | null;
  estado: EstadoEnsayo;
  encargado_id: string | null;
  asistencia_cerrada: boolean;
  asistencia_cerrada_at: string | null;
  asistencia_cerrada_por: string | null;
  created_at: string;
  updated_at: string;
  perfiles: {
    nombre: string;
    apellido: string;
  } | null;
}

/**
 * Lista los ensayos PRÓXIMOS de un grupo (fecha_inicio >= ahora).
 * Orden ascendente por fecha. Excluye cancelados por default.
 */
export async function listarEnsayosProximos(
  grupoId: string,
  incluirCancelados = false,
): Promise<Result<EnsayoConEncargado[]>> {
  try {
    const selectClause = `
      id, grupo_id, titulo, fecha_inicio, fecha_fin, lugar, descripcion,
      tema, estado, encargado_id, asistencia_cerrada, asistencia_cerrada_at,
      asistencia_cerrada_por, created_at, updated_at,
      perfiles!ensayos_encargado_id_fkey (nombre, apellido)
    `;

    // Encadenamos los filters ANTES del `.returns()` porque el builder
    // pierde los filter methods después. Si queremos excluir cancelados,
    // agregamos `.neq('estado', 'cancelado')` al chain.
    const filteredQuery = incluirCancelados
      ? supabase
          .from('ensayos')
          .select(selectClause)
          .eq('grupo_id', grupoId)
          .gte('fecha_inicio', new Date().toISOString())
      : supabase
          .from('ensayos')
          .select(selectClause)
          .eq('grupo_id', grupoId)
          .gte('fecha_inicio', new Date().toISOString())
          .neq('estado', 'cancelado');

    const { data, error } = await filteredQuery
      .order('fecha_inicio', { ascending: true })
      .returns<EnsayoRow[]>();

    if (error) return { ok: false, error: mapSupabaseError(error) };

    return { ok: true, data: (data ?? []).map(rowToEnsayo) };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/**
 * Lista los ensayos PASADOS (fecha_inicio < ahora). Orden descendente.
 * Útil para el historial (RF-101) — feature futura, API lista.
 */
export async function listarEnsayosPasados(
  grupoId: string,
  limite = 20,
): Promise<Result<EnsayoConEncargado[]>> {
  try {
    const { data, error } = await supabase
      .from('ensayos')
      .select(
        `
        id, grupo_id, titulo, fecha_inicio, fecha_fin, lugar, descripcion,
        tema, estado, encargado_id, asistencia_cerrada, asistencia_cerrada_at,
        asistencia_cerrada_por, created_at, updated_at,
        perfiles!ensayos_encargado_id_fkey (nombre, apellido)
      `,
      )
      .eq('grupo_id', grupoId)
      .lt('fecha_inicio', new Date().toISOString())
      .order('fecha_inicio', { ascending: false })
      .limit(limite)
      .returns<EnsayoRow[]>();

    if (error) return { ok: false, error: mapSupabaseError(error) };

    return { ok: true, data: (data ?? []).map(rowToEnsayo) };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/** Trae un ensayo por id. */
export async function obtenerEnsayo(ensayoId: string): Promise<Result<EnsayoConEncargado>> {
  try {
    const { data, error } = await supabase
      .from('ensayos')
      .select(
        `
        id, grupo_id, titulo, fecha_inicio, fecha_fin, lugar, descripcion,
        tema, estado, encargado_id, asistencia_cerrada, asistencia_cerrada_at,
        asistencia_cerrada_por, created_at, updated_at,
        perfiles!ensayos_encargado_id_fkey (nombre, apellido)
      `,
      )
      .eq('id', ensayoId)
      .maybeSingle<EnsayoRow>();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    if (!data) return { ok: false, error: 'Ensayo no encontrado' };

    return { ok: true, data: rowToEnsayo(data) };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

function rowToEnsayo(row: EnsayoRow): EnsayoConEncargado {
  return {
    id: row.id,
    grupo_id: row.grupo_id,
    titulo: row.titulo,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    lugar: row.lugar,
    descripcion: row.descripcion,
    tema: row.tema,
    estado: row.estado,
    encargado_id: row.encargado_id,
    asistencia_cerrada: row.asistencia_cerrada,
    asistencia_cerrada_at: row.asistencia_cerrada_at,
    asistencia_cerrada_por: row.asistencia_cerrada_por,
    created_at: row.created_at,
    updated_at: row.updated_at,
    encargado:
      row.encargado_id && row.perfiles
        ? {
            usuario_id: row.encargado_id,
            nombre: row.perfiles.nombre,
            apellido: row.perfiles.apellido,
          }
        : null,
  };
}

// =============================================================================
// Mutaciones
// =============================================================================

/**
 * Crea un ensayo. Solo el admin del grupo puede (RLS lo enforcea).
 * El estado inicial es 'programado'.
 */
export async function crearEnsayo(
  input: CrearEnsayoInput,
): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('ensayos')
      .insert({
        grupo_id: input.grupo_id,
        titulo: input.titulo.trim(),
        fecha_inicio: input.fecha_inicio,
        fecha_fin: input.fecha_fin,
        lugar: input.lugar?.trim() || null,
        descripcion: input.descripcion?.trim() || null,
        tema: input.tema?.trim() || null,
        encargado_id: input.encargado_id,
        estado: 'programado',
      })
      .select('id')
      .single();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/** Edita campos de un ensayo. Solo admin (RLS). */
export async function editarEnsayo(
  ensayoId: string,
  cambios: EditarEnsayoInput,
): Promise<Result<{ id: string }>> {
  try {
    const patch: TablesUpdate<'ensayos'> = {};
    if (cambios.titulo !== undefined) patch.titulo = cambios.titulo.trim();
    if (cambios.fecha_inicio !== undefined) patch.fecha_inicio = cambios.fecha_inicio;
    if (cambios.fecha_fin !== undefined) patch.fecha_fin = cambios.fecha_fin;
    if (cambios.lugar !== undefined) patch.lugar = cambios.lugar?.trim() || null;
    if (cambios.descripcion !== undefined)
      patch.descripcion = cambios.descripcion?.trim() || null;
    if (cambios.tema !== undefined) patch.tema = cambios.tema?.trim() || null;
    if (cambios.encargado_id !== undefined) patch.encargado_id = cambios.encargado_id;

    if (Object.keys(patch).length === 0) {
      return { ok: false, error: 'Nada que actualizar' };
    }

    const { data, error } = await supabase
      .from('ensayos')
      .update(patch)
      .eq('id', ensayoId)
      .select('id')
      .single();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/**
 * Cancela un ensayo (RF-073). UPDATE: estado = 'cancelado'.
 * Las invitaciones se mantienen (es historial), pero el ensayo
 * queda marcado como cancelado.
 */
export async function cancelarEnsayo(ensayoId: string): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('ensayos')
      .update({ estado: 'cancelado' })
      .eq('id', ensayoId)
      .select('id')
      .single();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/**
 * Re-abre un ensayo cancelado (vuelve a 'programado'). Útil si el
 * admin se equivocó. No es un RF explícito, pero la acción inversa
 * a cancelar debería existir.
 */
export async function reabrirEnsayo(ensayoId: string): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('ensayos')
      .update({ estado: 'programado' })
      .eq('id', ensayoId)
      .select('id')
      .single();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Encargado (RF-071)
// =============================================================================

/**
 * Asigna o reemplaza el encargado del ensayo. Pasarle null para quitarlo.
 * El RLS valida que sea admin del grupo.
 */
export async function asignarEncargado(
  ensayoId: string,
  encargadoUsuarioId: string | null,
): Promise<Result<{ id: string }>> {
  return editarEnsayo(ensayoId, { encargado_id: encargadoUsuarioId });
}

// =============================================================================
// Invitados
// =============================================================================

interface InvitadoRow {
  id: string;
  ensayo_id: string;
  usuario_grupo_id: string;
  created_at: string;
  usuario_grupos: {
    id: string;
    usuario_id: string;
    rol: 'admin' | 'miembro';
    perfiles: { nombre: string; apellido: string } | null;
  } | null;
}

/** Lista los invitados a un ensayo con datos del miembro. */
export async function listarInvitados(
  ensayoId: string,
): Promise<Result<InvitadoEnsayoDetallado[]>> {
  try {
    const { data, error } = await supabase
      .from('invitados_ensayo')
      .select(
        `
        id, ensayo_id, usuario_grupo_id, created_at,
        usuario_grupos!invitados_ensayo_usuario_grupo_id_fkey (
          id, usuario_id, rol,
          perfiles!usuarios_grupos_usuario_id_fkey (nombre, apellido)
        )
      `,
      )
      .eq('ensayo_id', ensayoId)
      .returns<InvitadoRow[]>();

    if (error) return { ok: false, error: mapSupabaseError(error) };

    const out: InvitadoEnsayoDetallado[] = (data ?? [])
      .filter((row) => row.usuario_grupos?.perfiles)
      .map((row) => ({
        id: row.id,
        ensayo_id: row.ensayo_id,
        usuario_grupo_id: row.usuario_grupo_id,
        created_at: row.created_at,
        miembro: {
          usuario_grupo_id: row.usuario_grupos!.id,
          usuario_id: row.usuario_grupos!.usuario_id,
          nombre: row.usuario_grupos!.perfiles!.nombre,
          apellido: row.usuario_grupos!.perfiles!.apellido,
          rol: row.usuario_grupos!.rol,
        },
      }));

    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/** Invita a un miembro al ensayo. */
export async function invitarMiembro(
  ensayoId: string,
  usuarioGrupoId: string,
): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('invitados_ensayo')
      .insert({
        ensayo_id: ensayoId,
        usuario_grupo_id: usuarioGrupoId,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'Este miembro ya está invitado' };
      }
      return { ok: false, error: mapSupabaseError(error) };
    }
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/** Quita la invitación de un miembro. */
export async function quitarInvitado(
  ensayoId: string,
  usuarioGrupoId: string,
): Promise<Result<{ count: number }>> {
  try {
    const { data, error } = await supabase
      .from('invitados_ensayo')
      .delete()
      .eq('ensayo_id', ensayoId)
      .eq('usuario_grupo_id', usuarioGrupoId)
      .select('id');

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { count: data?.length ?? 0 } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Mis ensayos (para Mi semana)
// =============================================================================

interface MiEnsayoRow {
  id: string;
  grupo_id: string;
  titulo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  lugar: string | null;
  descripcion: string | null;
  tema: string | null;
  estado: EstadoEnsayo;
  invitados_ensayo: Array<{ id: string; usuario_grupo_id: string }>;
}

/**
 * Lista los ensayos en el rango [lunesISO, finISO) donde el usuario
 * actual está invitado. Mismo patrón que `listarMisServiciosEnRango`.
 */
export async function listarMisEnsayosEnRango(input: {
  grupoId: string;
  usuarioGrupoId: string;
  lunesISO: string;
  finISO: string;
}): Promise<Result<Ensayo[]>> {
  try {
    const { data, error } = await supabase
      .from('ensayos')
      .select(
        `
        id, grupo_id, titulo, fecha_inicio, fecha_fin, lugar, descripcion,
        tema, estado, asistencia_cerrada, asistencia_cerrada_at,
        asistencia_cerrada_por, created_at, updated_at,
        invitados_ensayo!inner (id, usuario_grupo_id)
      `,
      )
      .eq('grupo_id', input.grupoId)
      .eq('invitados_ensayo.usuario_grupo_id', input.usuarioGrupoId)
      .gte('fecha_inicio', input.lunesISO)
      .lt('fecha_inicio', input.finISO)
      .neq('estado', 'cancelado')
      .order('fecha_inicio', { ascending: true })
      .returns<MiEnsayoRow[]>();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    if (!data) return { ok: true, data: [] };

    // Strip the JOIN column before returning (consumers don't need it)
    const out: Ensayo[] = data.map((row) => ({
      id: row.id,
      grupo_id: row.grupo_id,
      titulo: row.titulo,
      fecha_inicio: row.fecha_inicio,
      fecha_fin: row.fecha_fin,
      lugar: row.lugar,
      descripcion: row.descripcion,
      tema: row.tema,
      estado: row.estado,
      encargado_id: null, // no se pide en el JOIN
      asistencia_cerrada: false,
      asistencia_cerrada_at: null,
      asistencia_cerrada_por: null,
      created_at: '',
      updated_at: '',
    }));
    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}
