/**
 * Hooks de React para el patrón recurrente.
 */
import { useCallback, useEffect, useState } from 'react';

import { guardarPatron as apiGuardarPatron, obtenerPatron as apiObtenerPatron } from './api';
import { PatronCompleto, PatronConfig } from './types';

export interface GuardarPatronInput {
  configuracion: PatronConfig;
  offset_alarma_min: number;
  semanas_generadas: number;
}

/**
 * Hook para cargar el patrón de un grupo al montar la pantalla.
 * Devuelve loading + error + el patrón (o null si no existe).
 */
export function usePatron(grupoId: string) {
  const [patron, setPatron] = useState<PatronCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await apiObtenerPatron(grupoId);
    if (!result.ok) {
      setError(result.error);
      setPatron(null);
    } else {
      setPatron(result.data);
    }
    setLoading(false);
  }, [grupoId]);

  useEffect(() => {
    if (grupoId) void load();
  }, [grupoId, load]);

  return { patron, loading, error, refetch: load };
}

/**
 * Hook para guardar el patrón (upsert). Maneja loading + error.
 */
export function useGuardarPatron() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = useCallback(
    async (grupoId: string, input: GuardarPatronInput) => {
      setLoading(true);
      setError(null);
      const result = await apiGuardarPatron({
        grupo_id: grupoId,
        ...input,
      });
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      return true;
    },
    [],
  );

  return { guardar, loading, error, clearError: () => setError(null) };
}
