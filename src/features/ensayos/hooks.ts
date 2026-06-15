/**
 * Hooks de la feature Ensayos.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  asignarEncargado as apiAsignarEncargado,
  cancelarEnsayo as apiCancelarEnsayo,
  crearEnsayo as apiCrearEnsayo,
  editarEnsayo as apiEditarEnsayo,
  invitarMiembro as apiInvitarMiembro,
  listarEnsayosProximos as apiListarProximos,
  listarInvitados as apiListarInvitados,
  obtenerEnsayo as apiObtenerEnsayo,
  quitarInvitado as apiQuitarInvitado,
  reabrirEnsayo as apiReabrirEnsayo,
} from './api';
import {
  CrearEnsayoInput,
  EditarEnsayoInput,
  EnsayoConEncargado,
  InvitadoEnsayoDetallado,
} from './types';

// Re-export del hook de miembros desde la feature asignaciones (lo
// necesitan las pantallas de ensayos para invitar y asignar encargado).
export { useMiembrosGrupo } from '@/features/asignaciones/hooks';

// =============================================================================
// useEnsayosProximos (RF-074)
// =============================================================================

export function useEnsayosProximos(grupoId: string) {
  const [data, setData] = useState<EnsayoConEncargado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!grupoId) return;
    setLoading(true);
    setError(null);
    const result = await apiListarProximos(grupoId);
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

  return { ensayos: data, loading, error, refetch: load };
}

// =============================================================================
// useEnsayo (detalle)
// =============================================================================

export function useEnsayo(ensayoId: string) {
  const [data, setData] = useState<EnsayoConEncargado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ensayoId) return;
    setLoading(true);
    setError(null);
    const result = await apiObtenerEnsayo(ensayoId);
    if (!result.ok) {
      setError(result.error);
      setData(null);
    } else {
      setData(result.data);
    }
    setLoading(false);
  }, [ensayoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ensayo: data, loading, error, refetch: load };
}

// =============================================================================
// useInvitadosEnsayo
// =============================================================================

export function useInvitadosEnsayo(ensayoId: string) {
  const [data, setData] = useState<InvitadoEnsayoDetallado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ensayoId) return;
    setLoading(true);
    setError(null);
    const result = await apiListarInvitados(ensayoId);
    if (!result.ok) {
      setError(result.error);
      setData([]);
    } else {
      setData(result.data);
    }
    setLoading(false);
  }, [ensayoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { invitados: data, loading, error, refetch: load };
}

// =============================================================================
// useGestionEnsayos (mutaciones)
// =============================================================================

export function useGestionEnsayos() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = useCallback(async (input: CrearEnsayoInput) => {
    setLoading(true);
    setError(null);
    const r = await apiCrearEnsayo(input);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return null;
    }
    return r.data;
  }, []);

  const editar = useCallback(async (ensayoId: string, cambios: EditarEnsayoInput) => {
    setLoading(true);
    setError(null);
    const r = await apiEditarEnsayo(ensayoId, cambios);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    return true;
  }, []);

  const cancelar = useCallback(async (ensayoId: string) => {
    setLoading(true);
    setError(null);
    const r = await apiCancelarEnsayo(ensayoId);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    return true;
  }, []);

  const reabrir = useCallback(async (ensayoId: string) => {
    setLoading(true);
    setError(null);
    const r = await apiReabrirEnsayo(ensayoId);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    return true;
  }, []);

  const asignarEncargado = useCallback(async (ensayoId: string, usuarioId: string | null) => {
    setLoading(true);
    setError(null);
    const r = await apiAsignarEncargado(ensayoId, usuarioId);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    return true;
  }, []);

  const invitar = useCallback(async (ensayoId: string, usuarioGrupoId: string) => {
    setLoading(true);
    setError(null);
    const r = await apiInvitarMiembro(ensayoId, usuarioGrupoId);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    return true;
  }, []);

  const quitarInvitado = useCallback(async (ensayoId: string, usuarioGrupoId: string) => {
    setLoading(true);
    setError(null);
    const r = await apiQuitarInvitado(ensayoId, usuarioGrupoId);
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
    cancelar,
    reabrir,
    asignarEncargado,
    invitar,
    quitarInvitado,
  };
}
