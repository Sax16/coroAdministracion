/**
 * Hooks de React para la feature de Asignaciones.
 *
 * Decisiones:
 * - No usamos TanStack Query todavía. La app todavía no tiene instalado
 *   el provider; los hooks usan `useState` + `useEffect` directo (mismo
 *   patrón que `patron/hooks.ts` y `grupos/hooks.ts`). Migrar a
 *   TanStack Query queda para v0.2.0.
 * - El refetch es manual: la pantalla semanal tiene pull-to-refresh
 *   y la pantalla de asignación llama a `refetch()` del padre después
 *   de cada mutación.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  crearAsignacion as apiCrearAsignacion,
  crearAsignaciones as apiCrearAsignaciones,
  eliminarAsignacion as apiEliminarAsignacion,
  eliminarAsignacionesDeMiembro as apiEliminarAsigDeMiembro,
  listarMiembrosActivos as apiListarMiembros,
  listarServiciosSemana as apiListarServicios,
} from './api';
import { MiembroGrupo, RolServicio, ServicioConAsignaciones } from './types';

// =============================================================================
// Query hooks (lectura)
// =============================================================================

/**
 * Hook para cargar los servicios de la semana con sus asignaciones.
 *
 * @param grupoId - id del grupo activo
 * @param lunes - Date que representa el lunes de la semana a cargar
 */
export function useServiciosSemana(grupoId: string, lunes: Date) {
  const [data, setData] = useState<ServicioConAsignaciones[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!grupoId) return;
    setLoading(true);
    setError(null);
    // El rango de la semana va de lunes 00:00 (local) a lunes 00:00
    // (local, de la semana siguiente). Convertimos a ISO para que la DB
    // filtre por `fecha_inicio` (que está guardada como timestamptz UTC).
    //
    // El truco del timezone: el trigger `generar_servicios_desde_patron`
    // guarda "Domingo 19:00 Lima" como `lunes 00:00 UTC`. Si el `fin` lo
    // pusiéramos en `lunes 05:00 UTC` (= lunes Lima 00:00) los servicios
    // del domingo caerían 5 horas afuera del filtro. Solución: tomar el
    // lunes-siguiente Lima como exclusivo (es el patrón estándar ISO),
    // pero incluyendo el último instante del domingo Lima.
    const inicio = new Date(lunes);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 7);
    // `fin` ya apunta a lunes-siguiente Lima 00:00; el `.lt(fin)` en la
    // query es estricto (lt, no lte), así que cubre hasta el último ms
    // anterior — que en Lima equivale al domingo 23:59:59.999. Perfecto.
    const result = await apiListarServicios(grupoId, inicio.toISOString(), fin.toISOString());
    if (!result.ok) {
      setError(result.error);
      setData([]);
    } else {
      setData(result.data);
    }
    setLoading(false);
  }, [grupoId, lunes]);

  useEffect(() => {
    void load();
  }, [load]);

  return { servicios: data, loading, error, refetch: load };
}

/** Hook para listar los miembros activos del grupo (para selectores de asignación). */
export function useMiembrosGrupo(grupoId: string) {
  const [data, setData] = useState<MiembroGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!grupoId) return;
    setLoading(true);
    setError(null);
    const result = await apiListarMiembros(grupoId);
    if (!result.ok) {
      setError(result.error);
      setData([]);
    } else {
      setData(result.data);
    }
    setLoading(false);
  }, [grupoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { miembros: data, loading, error, refetch: load };
}

// =============================================================================
// Mutation hooks (escritura)
// =============================================================================

/**
 * Hook para crear y eliminar asignaciones desde la pantalla de detalle.
 * Devuelve un único objeto con loading + error consolidado, así la UI
 * solo muestra un spinner global y un único banner de error.
 */
export function useGestionAsignaciones() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = useCallback(
    async (input: { servicio_id: string; usuario_grupo_id: string; rol_servicio: RolServicio }) => {
      setLoading(true);
      setError(null);
      const result = await apiCrearAsignacion(input);
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      return true;
    },
    [],
  );

  const crearVarios = useCallback(
    async (items: Array<{ servicio_id: string; usuario_grupo_id: string; rol_servicio: RolServicio }>) => {
      setLoading(true);
      setError(null);
      const result = await apiCrearAsignaciones(items);
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      return true;
    },
    [],
  );

  const eliminar = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    const result = await apiEliminarAsignacion(id);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  const eliminarDeMiembro = useCallback(async (servicioId: string, usuarioGrupoId: string) => {
    setLoading(true);
    setError(null);
    const result = await apiEliminarAsigDeMiembro(servicioId, usuarioGrupoId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return {
    loading,
    error,
    clearError: () => setError(null),
    crear,
    crearVarios,
    eliminar,
    eliminarDeMiembro,
  };
}
