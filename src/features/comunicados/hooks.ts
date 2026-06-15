/**
 * Hooks de la feature Comunicados.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  crearComunicado as apiCrear,
  editarComunicado as apiEditar,
  eliminarComunicado as apiEliminar,
  listarComunicados as apiListar,
  obtenerComunicado as apiObtener,
} from './api';
import {
  Comunicado,
  CrearComunicadoInput,
  EditarComunicadoInput,
} from './types';

// =============================================================================
// useComunicados (listado RF-082)
// =============================================================================

export function useComunicados(grupoId: string) {
  const [data, setData] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!grupoId) return;
    setLoading(true);
    setError(null);
    const r = await apiListar(grupoId);
    if (!r.ok) {
      setError(r.error);
      setData([]);
    } else {
      setData(r.data);
    }
    setLoading(false);
  }, [grupoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { comunicados: data, loading, error, refetch: load };
}

// =============================================================================
// useComunicado (detalle)
// =============================================================================

export function useComunicado(comunicadoId: string) {
  const [data, setData] = useState<Comunicado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!comunicadoId) return;
    setLoading(true);
    setError(null);
    const r = await apiObtener(comunicadoId);
    if (!r.ok) {
      setError(r.error);
      setData(null);
    } else {
      setData(r.data);
    }
    setLoading(false);
  }, [comunicadoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { comunicado: data, loading, error, refetch: load };
}

// =============================================================================
// useGestionComunicados (mutaciones)
// =============================================================================

export function useGestionComunicados() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = useCallback(async (input: CrearComunicadoInput) => {
    setLoading(true);
    setError(null);
    const r = await apiCrear(input);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return null;
    }
    return r.data;
  }, []);

  const editar = useCallback(
    async (comunicadoId: string, cambios: EditarComunicadoInput) => {
      setLoading(true);
      setError(null);
      const r = await apiEditar(comunicadoId, cambios);
      setLoading(false);
      if (!r.ok) {
        setError(r.error);
        return false;
      }
      return true;
    },
    [],
  );

  const eliminar = useCallback(async (comunicadoId: string) => {
    setLoading(true);
    setError(null);
    const r = await apiEliminar(comunicadoId);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    return true;
  }, []);

  return {
    loading,
    error,
    clearError: () => setError(null),
    crear,
    editar,
    eliminar,
  };
}
