/**
 * Hooks de React para la feature de Asistencia.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  actualizarEstadoAsistencia as apiActualizarEstado,
  cerrarAsistencia as apiCerrar,
  guardarJustificacion as apiGuardarJust,
  obtenerMiEstadoEnServicio as apiObtenerMiEstado,
  obtenerResumenCierre as apiObtenerResumen,
  reabrirAsistencia as apiReabrir,
} from './api';
import { EstadoAsistencia, MiEstadoEnServicio, ResumenCierre } from './types';

// =============================================================================
// useResumenCierre (pantalla del responsable)
// =============================================================================

export function useResumenCierre(servicioId: string) {
  const [data, setData] = useState<ResumenCierre | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!servicioId) return;
    setLoading(true);
    setError(null);
    const r = await apiObtenerResumen(servicioId);
    if (!r.ok) {
      setError(r.error);
      setData(null);
    } else {
      setData(r.data);
    }
    setLoading(false);
  }, [servicioId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { resumen: data, loading, error, refetch: load };
}

// =============================================================================
// useMiEstadoEnServicio (miembro)
// =============================================================================

export function useMiEstadoEnServicio(servicioId: string) {
  const [data, setData] = useState<MiEstadoEnServicio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!servicioId) return;
    setLoading(true);
    setError(null);
    const r = await apiObtenerMiEstado(servicioId);
    if (!r.ok) {
      setError(r.error);
      setData(null);
    } else {
      setData(r.data);
    }
    setLoading(false);
  }, [servicioId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { miEstado: data, loading, error, refetch: load };
}

// =============================================================================
// useGestionCierre (responsable/admin)
// =============================================================================

export function useGestionCierre() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiarEstado = useCallback(
    async (estadoId: string, nuevo: EstadoAsistencia) => {
      setLoading(true);
      setError(null);
      const r = await apiActualizarEstado({
        estado_id: estadoId,
        nuevo_estado: nuevo,
      });
      setLoading(false);
      if (!r.ok) {
        setError(r.error);
        return false;
      }
      return true;
    },
    [],
  );

  const cerrar = useCallback(async (servicioId: string) => {
    setLoading(true);
    setError(null);
    const r = await apiCerrar(servicioId);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    return true;
  }, []);

  const reabrir = useCallback(async (servicioId: string) => {
    setLoading(true);
    setError(null);
    const r = await apiReabrir(servicioId);
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
    cambiarEstado,
    cerrar,
    reabrir,
  };
}

// =============================================================================
// useGestionJustificacion (miembro)
// =============================================================================

export function useGestionJustificacion() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = useCallback(async (servicioId: string, texto: string) => {
    if (!texto.trim()) {
      return { ok: false as const, error: 'La justificación no puede estar vacía' };
    }
    setLoading(true);
    setError(null);
    const r = await apiGuardarJust({
      servicio_id: servicioId,
      texto,
    });
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return { ok: false as const, error: r.error };
    }
    return { ok: true as const, id: r.data.id };
  }, []);

  return { guardar, loading, error, clearError: () => setError(null) };
}
