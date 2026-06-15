/**
 * Hooks de la feature "Mi semana".
 *
 * A partir de la integración con ensayos (RF-076), `useMiSemana` carga
 * TANTO servicios como ensayos en los que el usuario está
 * asignado/invitado, los mergea en un array `MiEvento` ordenado por
 * fecha, y los devuelve.
 *
 * El `useAlarmaScheduler` se extiende para agendar alarmas también
 * para los ensayos, con la misma lógica de offset y permisos que
 * los servicios.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import {
  cancelAllAlarms,
  pedirPermisosAlarma,
  scheduleAlarm,
} from '@/lib/notifications';
import { obtenerMisEstadosEnServicios } from '@/features/asistencia/api';
import { useAuthStore } from '@/stores/auth';

import { listarMisServiciosEnRango } from './api';
import { listarMisEnsayosEnRango } from '@/features/ensayos/api';
import { MiEvento, MiEventoEnsayo, MiEventoServicio } from './types';

// =============================================================================
// useMiSemana
// =============================================================================

/**
 * Carga los servicios + ensayos del usuario actual en el grupo, en el
 * rango de 14 días (semana actual + siguiente), y los mergea ordenados
 * por `fecha_inicio` ascendente.
 *
 * @param grupoId - id del grupo activo
 * @param lunes - lunes de la semana actual (la pantalla carga 14 días)
 */
export function useMiSemana(grupoId: string, lunes: Date) {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<MiEvento[]>([]);
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

    // 3. Cargar servicios y ensayos EN PARALELO
    const [serviciosRes, ensayosRes] = await Promise.all([
      listarMisServiciosEnRango({
        grupoId,
        usuarioGrupoId: ug.id,
        lunesISO: inicio.toISOString(),
        finISO: fin.toISOString(),
      }),
      listarMisEnsayosEnRango({
        grupoId,
        usuarioGrupoId: ug.id,
        lunesISO: inicio.toISOString(),
        finISO: fin.toISOString(),
      }),
    ]);

    if (!serviciosRes.ok) {
      setError(serviciosRes.error);
      setData([]);
      setLoading(false);
      return;
    }
    if (!ensayosRes.ok) {
      setError(ensayosRes.error);
      setData([]);
      setLoading(false);
      return;
    }

    // 3b. Cargar mi estado de asistencia en cada servicio (RF-091/096).
    // Solo si hay servicios. Esto hidrata el botón "Justificar".
    let misEstadosMap = new Map<
      string,
      { asignacion_id: string; estado: 'asistio' | 'no_asistio' | 'justificado'; justificacion: string | null }
    >();
    if (serviciosRes.data.length > 0) {
      const estadosRes = await obtenerMisEstadosEnServicios({
        servicioIds: serviciosRes.data.map((s) => s.id),
      });
      if (estadosRes.ok) {
        misEstadosMap = estadosRes.data;
      }
    }

    // 4. Merge a MiEvento (discriminated union)
    const servicios: MiEventoServicio[] = serviciosRes.data.map((s) => {
      const miEstado = misEstadosMap.get(s.id);
      return {
        kind: 'servicio' as const,
        id: s.id,
        fecha_inicio: s.fecha_inicio,
        titulo: s.titulo,
        lugar: s.lugar,
        estado: s.estado,
        mis_roles: s.mis_roles,
        mi_estado: miEstado?.estado ?? null,
        mi_justificacion: miEstado?.justificacion ?? null,
      };
    });

    const ensayos: MiEventoEnsayo[] = ensayosRes.data.map((e) => ({
      kind: 'ensayo' as const,
      id: e.id,
      fecha_inicio: e.fecha_inicio,
      titulo: e.titulo,
      lugar: e.lugar,
      estado: e.estado,
      mis_roles: [],
    }));

    // 5. Ordenar por fecha_inicio ascendente
    const merged: MiEvento[] = [...servicios, ...ensayos].sort(
      (a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime(),
    );

    setData(merged);

    // 6. Cargar offset del patrón del grupo
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

  return { eventos: data, loading, error, refetch: load, offsetMinutos };
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
 * Hook que pide permiso + agenda las alarmas de los eventos del
 * usuario (servicios + ensayos) cada vez que cambian los `eventos` o
 * el `offsetMinutos`.
 *
 * Estabilización: el `useEffect` no depende de la identidad del array
 * `eventos` (cambia en cada render), sino de una firma estable basada
 * en los IDs. Esto evita re-agendar en loop infinito cada vez que el
 * padre hace `setData`.
 */
export function useAlarmaScheduler(
  eventos: MiEvento[],
  offsetMinutos: number,
  grupoNombre: string,
): UseAlarmaSchedulerResult {
  const [loading, setLoading] = useState(false);
  const [permiso, setPermiso] = useState<UseAlarmaSchedulerResult['permiso']>('idle');
  const [ultimaVezAgendado, setUltimaVezAgendado] = useState<number | null>(null);
  const [cantidadAgendadas, setCantidadAgendadas] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Firma estable: string con IDs ordenados + kind. Solo cambia si el
  // conjunto de eventos cambia (no en cada render).
  const firmaEventos = useMemo(
    () =>
      eventos
        .map((e) => `${e.kind}:${e.id}:${e.estado}`)
        .sort()
        .join('|'),
    [eventos],
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
        setLoading(false);
        return;
      }

      // 2. Limpiar alarmas anteriores y agendar las nuevas
      await cancelAllAlarms();

      let count = 0;
      for (const ev of eventos) {
        // Solo agendamos para eventos `programado` (no realizado, no cancelado)
        if (ev.estado !== 'programado') continue;

        const titulo =
          ev.kind === 'ensayo'
            ? `Ensayo: ${ev.titulo}`
            : (ev.titulo ?? 'Servicio');

        const result = await scheduleAlarm({
          servicioId: ev.id, // el identificador único del evento
          fechaInicioISO: ev.fecha_inicio,
          offsetMinutos,
          tituloServicio: titulo,
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
  }, [firmaEventos, offsetMinutos, grupoNombre]);

  return { loading, permiso, ultimaVezAgendado, cantidadAgendadas, error };
}
