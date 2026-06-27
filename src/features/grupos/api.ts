/**
 * API de grupos contra Supabase.
 *
 * Wrappers finos sobre `supabase` para que el resto de la app no toque
 * la SDK directamente. Las operaciones privilegiadas (crear grupo)
 * invocan las SECURITY DEFINER functions de la DB.
 */
import { supabase } from '@/lib/supabase';
import { Result } from '@/lib/result';
import { mapErr, mapSupabaseError } from '@/lib/errores';

export interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  admin_id: string;
  zona_horaria: string;
  created_at: string;
  deleted_at: string | null;
}

export interface GrupoConRol extends Grupo {
  rol: 'admin' | 'miembro';
}

/**
 * Lista los grupos del usuario actual con su rol.
 *
 * Query directa a `usuarios_grupos` con JOIN a `grupos`, filtrada por
 * el usuario actual (RLS lo acota a los grupos donde es miembro activo).
 */
export async function listarMisGrupos(): Promise<Result<GrupoConRol[]>> {
  try {
    const { data, error } = await supabase
      .from('usuarios_grupos')
      .select(
        `
        rol,
        grupo:grupos ( id, nombre, descripcion, admin_id, zona_horaria, created_at, deleted_at )
      `,
      )
      .eq('estado', 'activo');

    if (error) return { ok: false, error: mapSupabaseError(error) };

    const mapped: GrupoConRol[] = (data ?? []).flatMap((row) => {
      const g = Array.isArray(row.grupo) ? row.grupo[0] : row.grupo;
      if (!g || g.deleted_at) return [];
      return [
        {
          ...g,
          rol: row.rol,
        },
      ];
    });

    return { ok: true, data: mapped };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/**
 * Crea un grupo nuevo y asigna al usuario actual como Admin.
 *
 * Implementación: invoca la SECURITY DEFINER function `crear_grupo()`
 * que es la única ruta válida (hace INSERT grupo + INSERT ug admin +
 * INSERT patron_recurrente vacío en una transacción).
 *
 * La RLS de INSERT directo en `grupos` está abierta (WITH CHECK (true))
 * pero cualquier INSERT directo deja invariantes rotas (sin fila admin
 * en `usuarios_grupos`). La función es la única que mantiene la
 * garantía.
 */
export async function crearGrupo(input: {
  nombre: string;
  descripcion?: string;
}): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await supabase.rpc('crear_grupo', {
      p_nombre: input.nombre.trim(),
      p_descripcion: input.descripcion?.trim() || undefined,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    if (!data) return { ok: false, error: 'La función no devolvió un ID' };

    return { ok: true, data: { id: data as string } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Transferir admin (RF-013) y Eliminar grupo (RF-012)
// =============================================================================
//
// Estas dos operaciones están acá, en grupos, porque son acciones sobre
// el grupo. Se usan desde dos lugares:
//   1. Admin del grupo, desde el home del grupo (RF-012, RF-013).
//   2. Pre-flight del flujo "Eliminar mi cuenta" (RF-006): si el usuario
//      es admin de grupos activos, tiene que resolverlos primero.

/**
 * Transfiere el rol admin a otro miembro activo del grupo (RF-013).
 *
 * Llama a la SECURITY DEFINER function `transferir_admin(grupo_id,
 * nuevo_admin_usuario_grupo_id)` que hace las 3 updates en una
 * transacción: viejo admin → miembro, nuevo → admin, `grupos.admin_id`
 * → nuevo.
 *
 * El parámetro `nuevoAdminUsuarioGrupoId` es el id de la fila en
 * `usuarios_grupos` del nuevo admin (no el `usuario_id` de auth).
 */
export async function transferirAdmin(input: {
  grupoId: string;
  nuevoAdminUsuarioGrupoId: string;
}): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('transferir_admin', {
      p_grupo_id: input.grupoId,
      p_nuevo_admin_usuario_grupo_id: input.nuevoAdminUsuarioGrupoId,
    });
    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Editar grupo (RF-011)
// =============================================================================

/**
 * Edita nombre y descripción de un grupo (RF-011).
 *
 * Implementación: UPDATE directo a `public.grupos` filtrado por
 * `id = grupoId`. La RLS "grupos: actualizar solo admin" exige que el
 * usuario actual sea admin del grupo, así que no hace falta validar
 * nada del lado de la app — la DB rechaza el UPDATE con 403/42501 si
 * no sos admin.
 *
 * El trigger `trg_grupos_set_updated_at` mantiene el timestamp fresco.
 *
 * Solo se editan nombre y descripción (scope del MVP). El `admin_id` y
 * la zona horaria se manejan en flujos separados (RF-013 y v0.2.0).
 */
export async function editarGrupo(input: {
  id: string;
  nombre: string;
  descripcion: string | null;
}): Promise<Result<{ id: string; nombre: string; descripcion: string | null }>> {
  try {
    const { data, error } = await supabase
      .from('grupos')
      .update({
        nombre: input.nombre.trim(),
        descripcion: input.descripcion?.trim() || null,
      })
      .eq('id', input.id)
      .select('id, nombre, descripcion')
      .maybeSingle();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    if (!data) return { ok: false, error: 'No se pudo actualizar el grupo' };

    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/**
 * Elimina (soft delete) un grupo (RF-012).
 *
 * Llama a la SECURITY DEFINER function `eliminar_grupo(grupo_id)` que
 * hace `grupos.deleted_at = now()` + `usuarios_grupos.estado = 'inactivo'`
 * para todos los miembros en una transacción.
 *
 * Después de esto, el grupo ya no aparece en ningún listado (la RLS +
 * la helper `usuario_grupos_activos()` filtran por `estado='activo'`).
 * Los datos históricos (servicios, ensayos, asignaciones, etc.) se conservan.
 */
export async function eliminarGrupo(grupoId: string): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('eliminar_grupo', {
      p_grupo_id: grupoId,
    });
    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

// =============================================================================
// Listado de grupos donde el usuario es admin (RF-006 pre-flight)
// =============================================================================

/**
 * Devuelve los grupos donde el usuario actual es admin y el grupo está
 * activo (no soft-deleted). Lo usa el flujo "Eliminar mi cuenta" para
 * mostrarle al usuario qué grupos tiene que resolver antes de poder
 * borrar la cuenta.
 *
 * Reutiliza `listarMisGrupos` y filtra en JS: más simple y eficiente
 * que una query aparte, y la cantidad de grupos por usuario es chica.
 */
export async function listarGruposAdminActivos(): Promise<Result<GrupoConRol[]>> {
  const r = await listarMisGrupos();
  if (!r.ok) return r;
  return { ok: true, data: r.data.filter((g) => g.rol === 'admin') };
}
