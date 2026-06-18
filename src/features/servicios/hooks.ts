/**
 * Hooks de React para la feature de Servicios.
 *
 * Por ahora solo cubre las acciones admin (RF-042 cancelar, RF-043
 * crear excepcional). Los SELECTs a `servicios` siguen en la feature
 * `asignaciones/` porque ahí nació la vista semanal; en v0.2.0
 * movemos todo a `servicios/` para unificar.
 */
import { useCallback, useState } from 'react';

import {
  cancelarServicio as apiCancelarServicio,
  crearServicioExcepcional as apiCrearServicioExcepcional,
  CrearServicioExcepcionalInput,
  ServicioCancelado,
  ServicioCreado,
} from './api';

// =============================================================================
// Cancelar servicio (RF-042)
// =============================================================================

/**
 * Hook para cancelar un servicio (RF-042).
 *
 * Devuelve el row actualizado (`{ id, estado: 'cancelado' }`) en éxito
 * o `null` en error. La UI muestra el error con `error` + `clearError`.
 */
export function useCancelarServicio() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelar = useCallback(
    async (servicioId: string): Promise<ServicioCancelado | null> => {
      setLoading(true);
      setError(null);
      const r = await apiCancelarServicio(servicioId);
      setLoading(false);
      if (!r.ok) {
        setError(r.error);
        return null;
      }
      return r.data;
    },
    [],
  );

  return { cancelar, loading, error, clearError: () => setError(null) };
}

// =============================================================================
// Crear servicio excepcional (RF-043)
// =============================================================================

/**
 * Hook para crear un servicio fuera del patrón (RF-043).
 *
 * Devuelve el servicio creado (`{ id, titulo, fecha_inicio }`) en éxito
 * o `null` en error.
 */
export function useCrearServicioExcepcional() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = useCallback(
    async (input: CrearServicioExcepcionalInput): Promise<ServicioCreado | null> => {
      setLoading(true);
      setError(null);
      const r = await apiCrearServicioExcepcional(input);
      setLoading(false);
      if (!r.ok) {
        setError(r.error);
        return null;
      }
      return r.data;
    },
    [],
  );

  return { crear, loading, error, clearError: () => setError(null) };
}
