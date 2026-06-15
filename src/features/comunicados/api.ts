/**
 * API de Comunicados contra Supabase.
 *
 * Cubre RF-080 (crear), RF-081 (editar/eliminar), RF-082 (listar),
 * RF-083 (push), RF-084 (no asistencia).
 *
 * La RLS de la tabla `public.comunicados` enforcea:
 * - select: miembros del grupo
 * - insert: admin del grupo
 * - update: admin del grupo
 * - delete: admin del grupo
 */
import { supabase } from '@/lib/supabase';
import { Result } from '@/lib/result';

import {
  Comunicado,
  CrearComunicadoInput,
  EditarComunicadoInput,
} from './types';

function mapErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

// =============================================================================
// Listados
// =============================================================================

/**
 * Lista los comunicados de un grupo en orden cronológico DESCENDENTE
 * (más reciente primero). Sin filtros de fecha por ahora — los
 * comunicados se mantienen visibles indefinidamente. Si el volumen
 * crece, se puede agregar paginación o filtros.
 */
export async function listarComunicados(
  grupoId: string,
  limite = 50,
): Promise<Result<Comunicado[]>> {
  try {
    const { data, error } = await supabase
      .from('comunicados')
      .select('id, grupo_id, titulo, descripcion, fecha_inicio, lugar, created_at')
      .eq('grupo_id', grupoId)
      .order('created_at', { ascending: false })
      .limit(limite)
      .returns<Comunicado[]>();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data ?? [] };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/** Trae un comunicado por id. */
export async function obtenerComunicado(
  comunicadoId: string,
): Promise<Result<Comunicado>> {
  try {
    const { data, error } = await supabase
      .from('comunicados')
      .select('id, grupo_id, titulo, descripcion, fecha_inicio, lugar, created_at')
      .eq('id', comunicadoId)
      .maybeSingle<Comunicado>();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'Comunicado no encontrado' };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Mutaciones
// =============================================================================

/**
 * Crea un comunicado. Solo admin del grupo (RLS lo enforcea).
 * El push a todos los miembros lo dispara la app después de un
 * INSERT exitoso, llamando a `notificarPush('comunicado_publicado', ...)`.
 */
export async function crearComunicado(
  input: CrearComunicadoInput,
): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('comunicados')
      .insert({
        grupo_id: input.grupo_id,
        titulo: input.titulo.trim(),
        descripcion: input.descripcion.trim(),
        fecha_inicio: input.fecha_inicio,
        lugar: input.lugar?.trim() || null,
      })
      .select('id')
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/** Edita campos de un comunicado. Solo admin (RLS). */
export async function editarComunicado(
  comunicadoId: string,
  cambios: EditarComunicadoInput,
): Promise<Result<{ id: string }>> {
  try {
    const patch: Record<string, unknown> = {};
    if (cambios.titulo !== undefined) patch.titulo = cambios.titulo.trim();
    if (cambios.descripcion !== undefined)
      patch.descripcion = cambios.descripcion.trim();
    if (cambios.fecha_inicio !== undefined) patch.fecha_inicio = cambios.fecha_inicio;
    if (cambios.lugar !== undefined) patch.lugar = cambios.lugar?.trim() || null;

    if (Object.keys(patch).length === 0) {
      return { ok: false, error: 'Nada que actualizar' };
    }

    const { data, error } = await supabase
      .from('comunicados')
      .update(patch)
      .eq('id', comunicadoId)
      .select('id')
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/** Elimina un comunicado. Solo admin (RLS). */
export async function eliminarComunicado(
  comunicadoId: string,
): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from('comunicados')
      .delete()
      .eq('id', comunicadoId)
      .select('id')
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}
