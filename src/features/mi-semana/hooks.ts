/**
 * Hooks de la feature "Mi semana".
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import {
  cancelAllAlarms,
  pedirPermisosAlarma,
  scheduleAlarm,
} from '@/lib/notifications';
import { useAuthStore } from '@/stores/auth';

import { listarMisServiciosEnRango } from './api';
import { MiServicio } from './types';

// =============================================================================
// useMiSemana
// =============================================================================

/**
 * Carga los servicios del usuario actual en el grupo, en el rango
 * de 14 días (semana actual + siguiente).
 *
 * @param grupoId - id del grupo activo
 * @param lunes - lunes de la semana actual (la pantalla carga 14 días)
 */
export function useMiSemana(grupoId: string, lunes: Date) {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<MiServicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Offset de alarma configurado en el patrón del grupo. Default 60. */
  const [offsetMinutos, setOffsetMinutos] = useState<number>(60);

  const load = useCallback(async () => {
    if (!grupoId || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    // 1. Necesitamos el usuario_grupo_id del usuario actual en este grupo
    const { data: ug, error: errUg } = await supabase
      .from('usuarios_grupos')
      .select('id')
      .eq('grupo_id', grupoId)
      .eq('usuario_id', user.id)
      .eq('estado', 'activo')
      .maybeSingle();

    if (errUg) {
      setError(errUg.message);
      setData([]);
      setLoading(false);
      return;
    }
    if (!ug) {
      // El usuario no es miembro activo de este grupo. Raro pero
      // posible (race condition en signOut, etc).
      setError('No sos miembro activo de este grupo');
      setData([]);
      setLoading(false);
      return;
    }

    // 2. Calcular rango: 14 días desde el lunes
    const inicio = new Date(lunes);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 14);

    // 3. Cargar servicios
    const result = await listarMisServiciosEnRango({
      grupoId,
      usuarioGrupoId: ug.id,
      lunesISO: inicio.toISOString(),
      finISO: fin.toISOString(),
    });

    if (!result.ok) {
      setError(result.error);
      setData([]);
      setLoading(false);
      return;
    }

    setData(result.data);

    // 4. Cargar offset del patrón del grupo
    const { data: patron } = await supabase
      .from('patrones_recurrentes')
      .select('offset_alarma_min')
      .eq('grupo_id', grupoId)
      .maybeSingle();

    if (patron?.offset_alarma_min != null) {
      setOffsetMinutos(patron.offset_alarma_min);
    }

    setLoading(false);
  }, [grupoId, user, lunes]);

  useEffect(() => {
    void load();
  }, [load]);

  return { servicios: data, loading, error, refetch: load, offsetMinutos };
}

// =============================================================================
// useAlarmaScheduler
// =============================================================================

interface UseAlarmaSchedulerResult {
  /** True mientras se está pidiendo permiso o agendando alarmas. */
  loading: boolean;
  /** Estado del permiso: 'granted' | 'denied' | 'undetermined' | 'idle'. */
  permiso: 'granted' | 'denied' | 'undetermined' | 'idle';
  /** Última vez que se agendaron alarmas (epoch ms). */
  ultimaVezAgendado: number | null;
  /** Cantidad de alarmas agendadas en el último ciclo. */
  cantidadAgendadas: number;
  /** Error del último ciclo. */
  error: string | null;
}

/**
 * Hook que pide permiso + agenda las alarmas de los servicios del usuario
 * cada vez que cambian los `servicios` o el `offsetMinutos`.
 *
 * Estabilización: el `useEffect` no depende de la identidad del array
 * `servicios` (cambia en cada render), sino de una firma estable basada
 * en los IDs. Esto evita re-agendar en loop infinito cada vez que el
 * padre hace `setData`.
 *
 * Llamar en `useEffect` de la pantalla "Mi semana".
 */
export function useAlarmaScheduler(
  servicios: MiServicio[],
  offsetMinutos: number,
  grupoNombre: string,
): UseAlarmaSchedulerResult {
  const [loading, setLoading] = useState(false);
  const [permiso, setPermiso] = useState<UseAlarmaSchedulerResult['permiso']>('idle');
  const [ultimaVezAgendado, setUltimaVezAgendado] = useState<number | null>(null);
  const [cantidadAgendadas, setCantidadAgendadas] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Firma estable: string con IDs ordenados. Solo cambia si el conjunto
  // de servicios cambia (no en cada render).
  const firmaServicios = useMemo(
    () => servicios.map((s) => `${s.id}:${s.estado}`).sort().join('|'),
    [servicios],
  );

  useEffect(() => {
    let cancelado = false;
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    (async () => {
      setLoading(true);
      setError(null);

      // 1. Pedir permisos
      const r = await pedirPermisosAlarma();
      if (cancelado) return;
      if (!r.ok) {
        setError(r.error);
        setPermiso('denied');
        setLoading(false);
        return;
      }
      setPermiso(r.data);

      if (r.data !== 'granted') {
        // Sin permiso, no agendamos nada
        setLoading(false);
        return;
      }

      // 2. Limpiar alarmas anteriores del grupo y agendar las nuevas
      // (idempotente: si el usuario vuelve a abrir la pantalla o
      // cambia la semana, se reprograma todo desde cero).
      await cancelAllAlarms();

      let count = 0;
      for (const s of servicios) {
        // Solo agendamos para servicios `programado` (no realizado, no cancelado)
        if (s.estado !== 'programado') continue;

        const result = await scheduleAlarm({
          servicioId: s.id,
          fechaInicioISO: s.fecha_inicio,
          offsetMinutos,
          tituloServicio: s.titulo ?? 'Servicio',
          grupoNombre,
        });
        if (result.ok && result.data) {
          count++;
        }
      }

      if (cancelado) return;
      setCantidadAgendadas(count);
      setUltimaVezAgendado(Date.now());
      setLoading(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [firmaServicios, offsetMinutos, grupoNombre]);

  return { loading, permiso, ultimaVezAgendado, cantidadAgendadas, error };
}
