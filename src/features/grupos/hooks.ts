/**
 * Hooks de React para grupos.
 */
import { useCallback, useState } from 'react';

import { GrupoActivo, useGrupoActivoStore } from '@/stores/grupoActivo';

import { crearGrupo as apiCrearGrupo, listarMisGrupos, GrupoConRol } from './api';

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
