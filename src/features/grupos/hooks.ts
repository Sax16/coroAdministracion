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

/**
 * Mutación: eliminar (soft delete) un grupo (RF-012). Invalida la lista.
 */
export function useEliminarGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (grupoId: string) => apiEliminarGrupo(grupoId).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.grupos() }),
  });
}

/**
 * Mutación: transferir el rol admin a otro miembro (RF-013). Invalida la lista.
 */
export function useTransferirAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { grupoId: string; nuevoAdminUsuarioGrupoId: string }) =>
      apiTransferirAdmin(input).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.grupos() }),
  });
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
