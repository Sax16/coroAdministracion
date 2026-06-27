/**
 * API de "Mi semana" contra Supabase.
 *
 * RF-054: cada miembro ve sus servicios de la semana actual y la
 * siguiente (rango de 14 días, lunes a domingo).
 *
 * Implementación:
 * 1. Buscar el `usuario_grupo_id` del usuario actual en este grupo.
 * 2. Query a `servicios` filtrado por grupo + rango de fechas, con
 *    JOIN a `asignaciones_servicio` filtrado por `usuario_grupo_id`.
 * 3. Merge en JS: un servicio aparece si tiene AL MENOS una asignación
 *    del usuario actual.
 *
 * No usamos `maybeSingle` ni nada raro: el join es de Supabase, viene
 * como array. Filtramos en el WHERE del JOIN.
 */
import { supabase } from '@/lib/supabase';
import { Result } from '@/lib/result';
import { mapErr, mapSupabaseError } from '@/lib/errores';
import { RolServicio } from '@/features/asignaciones/types';

import { MiServicio } from './types';

interface ServicioRow {
  id: string;
  grupo_id: string;
  tipo: 'servicio' | 'ensayo' | 'comunicado';
  titulo: string | null;
  fecha_inicio: string;
  estado: 'programado' | 'cancelado' | 'realizado';
  lugar: string | null;
  asignaciones_servicio: Array<{
    id: string;
    rol_servicio: RolServicio;
    usuario_grupo_id: string;
  }>;
}

/**
 * Devuelve los servicios del grupo en el rango [lunesISO, finISO) donde
 * el usuario actual está asignado. Excluye cancelados (se muestran
 * aparte en la UI si el admin lo hace).
 *
 * @param grupoId - id del grupo activo
 * @param usuarioGrupoId - id de la fila en `usuarios_grupos` del usuario actual
 * @param lunesISO - inicio del rango (lunes 00:00 local, en ISO UTC)
 * @param finISO - fin del rango (exclusivo)
 */
export async function listarMisServiciosEnRango(input: {
  grupoId: string;
  usuarioGrupoId: string;
  lunesISO: string;
  finISO: string;
}): Promise<Result<MiServicio[]>> {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .select(
        `
        id,
        grupo_id,
        tipo,
        titulo,
        fecha_inicio,
        estado,
        lugar,
        asignaciones_servicio!inner (
          id,
          rol_servicio,
          usuario_grupo_id
        )
      `,
      )
      .eq('grupo_id', input.grupoId)
      .eq('asignaciones_servicio.usuario_grupo_id', input.usuarioGrupoId)
      .gte('fecha_inicio', input.lunesISO)
      .lt('fecha_inicio', input.finISO)
      .neq('estado', 'cancelado')
      .order('fecha_inicio', { ascending: true })
      .returns<ServicioRow[]>();

    if (error) return { ok: false, error: mapSupabaseError(error) };
    if (!data) return { ok: true, data: [] };

    const out: MiServicio[] = data.map((s) => ({
      id: s.id,
      fecha_inicio: s.fecha_inicio,
      titulo: s.titulo,
      tipo: s.tipo,
      estado: s.estado,
      lugar: s.lugar,
      mis_roles: s.asignaciones_servicio.map((a) => a.rol_servicio),
    }));

    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}
