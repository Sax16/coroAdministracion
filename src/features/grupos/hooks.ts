/**
 * Hooks de React para grupos.
 */
import { useCallback, useEffect, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import { GrupoActivo, useGrupoActivoStore } from '@/stores/grupoActivo';

import {
  crearGrupo as apiCrearGrupo,
  editarGrupo as apiEditarGrupo,
  eliminarGrupo as apiEliminarGrupo,
  listarGruposAdminActivos as apiListarGruposAdminActivos,
  listarMisGrupos,
  transferirAdmin as apiTransferirAdmin,
  GrupoConRol,
} from './api';

export interface CrearGrupoInput {
  nombre: string;
  descripcion?: string;
}

/**
 * Lista los grupos del usuario actual con su rol (cacheado por TanStack
 * Query bajo la key `qk.grupos()`). Varias pantallas comparten este caché.
 */
export function useMisGrupos() {
  return useQuery({
    queryKey: qk.grupos(),
    queryFn: () => listarMisGrupos().then(unwrap),
  });
}

/**
 * Mutación: crear un grupo nuevo. Invalida la lista al terminar.
 */
export function useCrearGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearGrupoInput) => apiCrearGrupo(input).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.grupos() }),
  });
}

/**
 * Hook para seleccionar el grupo activo. Persiste en AsyncStorage
 * para que la app abra en el último grupo usado.
 */
export function useGrupoActivo() {
  const grupo = useGrupoActivoStore((s) => s.grupo);
  const setGrupo = useGrupoActivoStore((s) => s.setGrupo);

  const seleccionar = useCallback(
    (g: GrupoActivo | null) => {
      setGrupo(g);
    },
    [setGrupo],
  );

  return { grupo, seleccionar };
}

// =============================================================================
// Acciones admin sobre el grupo: transferir (RF-013) y eliminar (RF-012)
// =============================================================================
//
// Estas dos acciones se usan desde dos pantallas:
//   - Home del grupo (admin ve el panel de acciones)
//   - Flujo "Eliminar mi cuenta" (RF-006), pre-flight

/**
 * Hook que agrupa las acciones admin sobre un grupo: transferir admin
 * y eliminar grupo. Maneja loading + error.
 */
export function useAccionesGrupo() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transferir = useCallback(
    async (input: { grupoId: string; nuevoAdminUsuarioGrupoId: string }) => {
      setLoading(true);
      setError(null);
      const r = await apiTransferirAdmin(input);
      setLoading(false);
      if (!r.ok) {
        setError(r.error);
        return false;
      }
      return true;
    },
    [],
  );

  const eliminar = useCallback(async (grupoId: string) => {
    setLoading(true);
    setError(null);
    const r = await apiEliminarGrupo(grupoId);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    return true;
  }, []);

  return {
    transferir,
    eliminar,
    loading,
    error,
    clearError: () => setError(null),
  };
}

// =============================================================================
// Editar grupo (RF-011)
// =============================================================================

/**
 * Mutación: editar nombre/descripción de un grupo (RF-011). Invalida la
 * lista al terminar.
 */
export function useEditarGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; nombre: string; descripcion: string | null }) =>
      apiEditarGrupo(input).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.grupos() }),
  });
}

/**
 * Lista los grupos donde el usuario actual es admin y el grupo está
 * activo. Usado por el flujo "Eliminar mi cuenta" (RF-006) para detectar
 * el bloqueo "no podés ser admin" antes de que la DB lo rechace.
 */
export function useGruposAdminActivos() {
  const [grupos, setGrupos] = useState<GrupoConRol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await apiListarGruposAdminActivos();
    if (!r.ok) {
      setError(r.error);
      setGrupos([]);
    } else {
      setGrupos(r.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { grupos, loading, error, refetch: load };
}
