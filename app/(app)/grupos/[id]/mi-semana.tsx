import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { GrupoConRol, listarMisGrupos } from '@/features/grupos/api';
import { useAlarmaScheduler, useMiSemana } from '@/features/mi-semana/hooks';
import { MiServicio } from '@/features/mi-semana/types';
import {
  ROLES_EMOJI,
  ROLES_LABELS,
  RolServicio,
} from '@/features/asignaciones/types';
import {
  agregarDias,
  DIAS_SEMANA_LABELS,
  formatearDiaCorto,
  formatearHora,
  getDiasSemana,
  getLunesSemana,
} from '@/features/asignaciones/types';
import { useAuthStore } from '@/stores/auth';

/**
 * Pantalla "Mi semana" (RF-054, RF-055, RF-063, RF-064).
 *
 * Es la pantalla principal del usuario autenticado. Muestra los servicios
 * en los que está asignado en el rango [lunes_actual, lunes_actual + 14d).
 *
 * Funcionalidades:
 * - Header con nombre del grupo + badge de "X alarmas agendadas"
 * - 14 cards (7 días × 2 semanas). Cada servicio es un bloque con
 *   hora, título, lugar y los roles del usuario (chips con emoji).
 * - Pull-to-refresh.
 * - Al montar: pide permiso de notificaciones + agenda una alarma local
 *   por cada servicio programado. La alarma usa el `offset_alarma_min`
 *   configurado en el patrón del grupo (default 60).
 * - Si es admin, muestra un FAB o botón en header "Administrar"
 *   que lleva a la vista de asignaciones para editar.
 *
 * Decisiones:
 * - La pantalla NO auto-refresca cuando el admin edita una asignación.
 *   El usuario hace pull-to-refresh. Para v0.1.0 alcanza; v0.2.0 con
 *   Realtime o TanStack Query se puede hacer más elegante.
 * - El agendamiento de alarmas es best-effort: si el permiso es
 *   'denied' o 'undetermined', seguimos mostrando la lista igual,
 *   solo no agendamos.
 */
export default function MiSemanaScreen() {
  const router = useRouter();
  const { id: grupoId } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const lunes = useMemo(() => getLunesSemana(new Date()), []);

  const [nombreGrupo, setNombreGrupo] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [cargandoGrupo, setCargandoGrupo] = useState(true);

  useEffect(() => {
    if (!grupoId || !user) return;
    let cancelado = false;
    (async () => {
      const result = await listarMisGrupos();
      if (cancelado) return;
      if (result.ok) {
        const g = (result.data as GrupoConRol[]).find((x) => x.id === grupoId);
        if (g) {
          setNombreGrupo(g.nombre);
          setEsAdmin(g.rol === 'admin');
        }
      }
      setCargandoGrupo(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [grupoId, user]);

  const { servicios, loading, error, refetch, offsetMinutos } = useMiSemana(grupoId ?? '', lunes);

  // Re-agendar alarmas cuando cambian los servicios o el offset
  const { cantidadAgendadas, permiso, loading: agendando } = useAlarmaScheduler(
    servicios,
    offsetMinutos,
    nombreGrupo ?? 'el grupo',
  );

  // Permiso denegado → mostrar CTA una vez
  useEffect(() => {
    if (permiso === 'denied') {
      Alert.alert(
        'Alarmas desactivadas',
        'Para que la app te avise antes de cada servicio, activá las notificaciones en los ajustes del sistema.',
        [
          { text: 'Más tarde', style: 'cancel' },
          { text: 'Ir a Ajustes', onPress: () => router.push('/(app)/grupos') },
        ],
      );
    }
  }, [permiso, router]);

  // Agrupar servicios por día para la vista
  const serviciosPorDia = useMemo(() => {
    const map = new Map<string, MiServicio[]>();
    for (const s of servicios) {
      const key = new Date(s.fecha_inicio).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [servicios]);

  const dias = useMemo(() => getDiasSemana(lunes), [lunes]);
  const diasSemana2 = useMemo(() => getDiasSemana(agregarDias(lunes, 7)), [lunes]);

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (cargandoGrupo && loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: nombreGrupo ? `Mi semana — ${nombreGrupo}` : 'Mi semana',
          headerBackTitle: 'Atrás',
        }}
      />

      {/* Banner de alarmas */}
      <View
        className={`border-b px-4 py-2 ${
          permiso === 'granted'
            ? 'border-emerald-200 bg-emerald-50'
            : permiso === 'denied'
              ? 'border-amber-200 bg-amber-50'
              : 'border-slate-200 bg-slate-50'
        }`}
      >
        <View className="flex-row items-center justify-between">
          <Text
            className={`text-xs ${
              permiso === 'granted'
                ? 'text-emerald-800'
                : permiso === 'denied'
                  ? 'text-amber-800'
                  : 'text-slate-600'
            }`}
          >
            {permiso === 'granted'
              ? agendando
                ? 'Agendando alarmas…'
                : `${cantidadAgendadas} alarma${cantidadAgendadas === 1 ? '' : 's'} agendada${cantidadAgendadas === 1 ? '' : 's'} (${offsetMinutos} min antes)`
              : permiso === 'denied'
                ? 'Alarmas desactivadas — activá las notificaciones para recibir avisos'
                : 'Pidiendo permiso de notificaciones…'}
          </Text>
          {esAdmin ? (
            <Pressable
              onPress={() => router.push(`/(app)/grupos/${grupoId}/asignaciones`)}
              hitSlop={8}
              className="rounded-md border border-primary-600 px-2.5 py-1 active:bg-primary-50"
            >
              <Text className="text-xs font-semibold text-primary-600">Administrar</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-slate-50"
        contentContainerClassName="pb-10"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      >
        {error ? (
          <View className="m-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        {/* Semana actual */}
        <SeccionSemana titulo="Esta semana" dias={dias} serviciosPorDia={serviciosPorDia} />

        {/* Semana siguiente */}
        <SeccionSemana
          titulo="Semana próxima"
          dias={diasSemana2}
          serviciosPorDia={serviciosPorDia}
        />
      </ScrollView>
    </>
  );
}

interface SeccionSemanaProps {
  titulo: string;
  dias: Date[];
  serviciosPorDia: Map<string, MiServicio[]>;
}

function SeccionSemana({ titulo, dias, serviciosPorDia }: SeccionSemanaProps) {
  return (
    <View className="mt-2">
      <Text className="mx-4 mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {titulo}
      </Text>
      {dias.map((dia, idx) => {
        const key = dia.toDateString();
        const items = serviciosPorDia.get(key) ?? [];
        return (
          <View key={key} className="mx-4 mb-2">
            <View className="mb-1.5 flex-row items-baseline">
              <Text className="text-sm font-semibold text-slate-500">
                {DIAS_SEMANA_LABELS[idx]}
              </Text>
              <Text className="ml-2 text-base font-semibold text-slate-900">
                {formatearDiaCorto(dia)}
              </Text>
            </View>
            {items.length === 0 ? (
              <View className="rounded-lg border border-dashed border-slate-200 bg-white p-3">
                <Text className="text-sm text-slate-400">Sin servicios asignados</Text>
              </View>
            ) : (
              items.map((s) => <MiServicioCard key={s.id} servicio={s} />)
            )}
          </View>
        );
      })}
    </View>
  );
}

function MiServicioCard({ servicio }: { servicio: MiServicio }) {
  return (
    <View className="mb-2 rounded-lg border border-slate-200 bg-white p-3">
      <View className="flex-row items-baseline">
        <Text className="text-lg font-semibold text-slate-900">
          {formatearHora(servicio.fecha_inicio)}
        </Text>
        {servicio.titulo ? (
          <Text className="ml-2 text-sm text-slate-600" numberOfLines={1}>
            {servicio.titulo}
          </Text>
        ) : null}
      </View>
      {servicio.lugar ? (
        <Text className="mt-1 text-xs text-slate-500">📍 {servicio.lugar}</Text>
      ) : null}
      <View className="mt-2 flex-row flex-wrap gap-1.5">
        {servicio.mis_roles.map((r: RolServicio, i: number) => (
          <View
            key={`${r}-${i}`}
            className="flex-row items-center rounded-full bg-primary-100 px-2.5 py-0.5"
          >
            <Text className="mr-1 text-xs">{ROLES_EMOJI[r]}</Text>
            <Text className="text-xs font-medium text-primary-700">{ROLES_LABELS[r]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
