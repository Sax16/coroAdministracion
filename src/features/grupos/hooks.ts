/**
 * Hooks de React para grupos.
 */
import { useCallback, useEffect, useState } from 'react';

import { GrupoActivo, useGrupoActivoStore } from '@/stores/grupoActivo';

import {
  crearGrupo as apiCrearGrupo,
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
 * Hook para listar los grupos del usuario actual.
 * Expone loading, error y refetch.
 */
export function useMisGrupos() {
  const [grupos, setGrupos] = useState<GrupoConRol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listarMisGrupos();
    if (!result.ok) {
      setError(result.error);
      setGrupos([]);
    } else {
      setGrupos(result.data);
    }
    setLoading(false);
  }, []);

  return { grupos, loading, error, refetch: load };
}

/**
 * Hook para crear un grupo nuevo.
 */
export function useCrearGrupo() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = useCallback(async (input: CrearGrupoInput) => {
    setLoading(true);
    setError(null);
    const result = await apiCrearGrupo(input);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    return result.data;
  }, []);

  return { crear, loading, error, clearError: () => setError(null) };
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
