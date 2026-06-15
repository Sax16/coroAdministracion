/**
 * Hooks de la feature Solicitudes.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  aprobarSolicitud as apiAprobar,
  buscarGrupos as apiBuscar,
  crearSolicitud as apiCrear,
  listarMisSolicitudesPendientes as apiListarMias,
  listarSolicitudesPendientes as apiListarPendientes,
  obtenerSolicitud as apiObtener,
  rechazarSolicitud as apiRechazar,
} from './api';
import { CrearSolicitudInput, GrupoDescubierto, SolicitudDetallada } from './types';

// =============================================================================
// useBuscarGrupos (RF-020)
// =============================================================================

/** Hook con debounce manual. Devuelve el query actual y los resultados. */
export function useBuscarGrupos() {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<GrupoDescubierto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-corre la búsqueda cada vez que cambia `query`, con un debounce
  // de 300ms para no pegarle a la DB en cada tecla.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResultados([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const r = await apiBuscar(query);
      if (!r.ok) {
        setError(r.error);
        setResultados([]);
      } else {
        setResultados(r.data);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  return { query, setQuery, resultados, loading, error };
}

// =============================================================================
// useMisSolicitudesPendientes (solicitante)
// =============================================================================

export function useMisSolicitudesPendientes() {
  const [data, setData] = useState<SolicitudDetallada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await apiListarMias();
    if (!r.ok) {
      setError(r.error);
      setData([]);
    } else {
      setData(r.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { solicitudes: data, loading, error, refetch: load };
}

// =============================================================================
// useSolicitudesPendientes (admin)
// =============================================================================

export function useSolicitudesPendientes(grupoId: string) {
  const [data, setData] = useState<SolicitudDetallada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!grupoId) return;
    setLoading(true);
    setError(null);
    const r = await apiListarPendientes(grupoId);
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

  return { solicitudes: data, loading, error, refetch: load };
}

// =============================================================================
// useSolicitud (detalle)
// =============================================================================

export function useSolicitud(solicitudId: string) {
  const [data, setData] = useState<SolicitudDetallada | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!solicitudId) return;
    setLoading(true);
    setError(null);
    const r = await apiObtener(solicitudId);
    if (!r.ok) {
      setError(r.error);
      setData(null);
    } else {
      setData(r.data);
    }
    setLoading(false);
  }, [solicitudId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { solicitud: data, loading, error, refetch: load };
}

// =============================================================================
// useGestionSolicitudes (mutaciones)
// =============================================================================

export function useGestionSolicitudes() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = useCallback(async (input: CrearSolicitudInput) => {
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

  const aprobar = useCallback(async (solicitudId: string) => {
    setLoading(true);
    setError(null);
    const r = await apiAprobar(solicitudId);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    return true;
  }, []);

  const rechazar = useCallback(async (solicitudId: string) => {
    setLoading(true);
    setError(null);
    const r = await apiRechazar(solicitudId);
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
    aprobar,
    rechazar,
  };
}
