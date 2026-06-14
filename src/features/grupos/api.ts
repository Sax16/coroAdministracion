/**
 * API de grupos contra Supabase.
 *
 * Wrappers finos sobre `supabase` para que el resto de la app no toque
 * la SDK directamente. Las operaciones privilegiadas (crear grupo)
 * invocan las SECURITY DEFINER functions de la DB.
 */
import { supabase } from '@/lib/supabase';

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

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function mapErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
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

    if (error) return { ok: false, error: error.message };

    const mapped: GrupoConRol[] = (data ?? []).flatMap((row: any) => {
      const g = row.grupo;
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
      p_descripcion: input.descripcion?.trim() || null,
    });

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'La función no devolvió un ID' };

    return { ok: true, data: { id: data as string } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}
