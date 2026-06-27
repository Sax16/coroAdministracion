import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useMisGrupos } from '@/features/grupos/hooks';
import { useAlarmaScheduler, useMiSemana } from '@/features/mi-semana/hooks';
import { MiEvento, MiEventoEnsayo, MiEventoServicio } from '@/features/mi-semana/types';
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

/**
 * Pantalla "Mi semana" (RF-054, RF-055, RF-063, RF-064, RF-076).
 *
 * Muestra los servicios + ensayos en los que el usuario actual está
 * asignado/invitado, en el rango [lunes_actual, lunes_actual + 14d).
 *
 * Diferencia con la vista semanal del admin (`/asignaciones`):
 * - Solo muestra eventos donde el usuario actual está asignado/invitado.
 * - No es editable.
 * - Al renderizar, agenda alarmas locales (servicios Y ensayos).
 *
 * Decisiones:
 * - Eventos cancelados no aparecen (filtrados en la query).
 * - El color del badge "Ensayo" vs "Servicio" diferencia visualmente
 *   los dos tipos de evento.
 * - La pantalla NO auto-refresca cuando el admin edita algo. El usuario
 *   hace pull-to-refresh. v0.2.0 con Realtime se puede mejorar.
 */
export default function MiSemanaScreen() {
  const router = useRouter();
  const { id: grupoId } = useLocalSearchParams<{ id: string }>();
  const lunes = useMemo(() => getLunesSemana(new Date()), []);

  const { data: misGrupos } = useMisGrupos();
  const grupoActual = misGrupos?.find((g) => g.id === grupoId);
  const nombreGrupo = grupoActual?.nombre ?? null;
  const esAdmin = grupoActual?.rol === 'admin';

  const { eventos, loading, error, refetch, offsetMinutos } = useMiSemana(
    grupoId ?? '',
    lunes,
  );

  // Re-agendar alarmas cuando cambian los eventos o el offset
  const { cantidadAgendadas, permiso, loading: agendando } = useAlarmaScheduler(
    eventos,
    offsetMinutos,
    nombreGrupo ?? 'el grupo',
  );

  useEffect(() => {
    if (permiso === 'denied') {
      Alert.alert(
        'Alarmas desactivadas',
        'Para que la app te avise antes de cada servicio o ensayo, activá las notificaciones en los ajustes del sistema.',
        [
          { text: 'Más tarde', style: 'cancel' },
          { text: 'Ir a Ajustes', onPress: () => void Linking.openSettings() },
        ],
      );
    }
  }, [permiso, router]);

  // Agrupar eventos por día
  const eventosPorDia = useMemo(() => {
    const map = new Map<string, MiEvento[]>();
    for (const e of eventos) {
      const key = new Date(e.fecha_inicio).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [eventos]);

  const dias = useMemo(() => getDiasSemana(lunes), [lunes]);
  const diasSemana2 = useMemo(() => getDiasSemana(agregarDias(lunes, 7)), [lunes]);

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (!grupoActual && loading) {
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
            className={`flex-1 text-xs ${
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
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => router.push(`/(app)/grupos/${grupoId}/ensayos`)}
                hitSlop={8}
                className="rounded-md border border-slate-300 px-2.5 py-1 active:bg-slate-50"
              >
                <Text className="text-xs font-semibold text-slate-700">Ensayos</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/(app)/grupos/${grupoId}/asignaciones`)}
                hitSlop={8}
                className="rounded-md border border-primary-600 px-2.5 py-1 active:bg-primary-50"
              >
                <Text className="text-xs font-semibold text-primary-600">Asignar</Text>
              </Pressable>
            </View>
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

        <SeccionSemana
          titulo="Esta semana"
          dias={dias}
          eventosPorDia={eventosPorDia}
          grupoId={grupoId ?? ''}
          onJustificar={(servicioId) =>
            router.push(`/(app)/grupos/${grupoId}/servicios/${servicioId}/justificar`)
          }
        />
        <SeccionSemana
          titulo="Semana próxima"
          dias={diasSemana2}
          eventosPorDia={eventosPorDia}
          grupoId={grupoId ?? ''}
          onJustificar={(servicioId) =>
            router.push(`/(app)/grupos/${grupoId}/servicios/${servicioId}/justificar`)
          }
        />
      </ScrollView>
    </>
  );
}

interface SeccionSemanaProps {
  titulo: string;
  dias: Date[];
  eventosPorDia: Map<string, MiEvento[]>;
  grupoId: string;
  onJustificar: (servicioId: string) => void;
}

function SeccionSemana({ titulo, dias, eventosPorDia, grupoId, onJustificar }: SeccionSemanaProps) {
  return (
    <View className="mt-2">
      <Text className="mx-4 mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {titulo}
      </Text>
      {dias.map((dia, idx) => {
        const key = dia.toDateString();
        const items = eventosPorDia.get(key) ?? [];
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
                <Text className="text-sm text-slate-400">Sin servicios ni ensayos</Text>
              </View>
            ) : (
              items.map((ev) => (
                <MiEventoCard
                  key={`${ev.kind}-${ev.id}`}
                  evento={ev}
                  grupoId={grupoId}
                  onJustificar={onJustificar}
                />
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}

function MiEventoCard({
  evento,
  grupoId: _grupoId,
  onJustificar,
}: {
  evento: MiEvento;
  grupoId: string;
  onJustificar: (servicioId: string) => void;
}) {
  if (evento.kind === 'servicio') {
    return <MiServicioCardUI evento={evento} onJustificar={onJustificar} />;
  }
  return <MiEnsayoCardUI evento={evento} />;
}

function MiServicioCardUI({
  evento,
  onJustificar,
}: {
  evento: MiEventoServicio;
  onJustificar: (servicioId: string) => void;
}) {
  // El servicio es post-evento si ya pasó (fecha_inicio < ahora) y no está cancelado.
  const fechaInicioMs = new Date(evento.fecha_inicio).getTime();
  const esPostEvento = fechaInicioMs < Date.now() && evento.estado === 'programado';

  // CTA Justificar: solo si el servicio ya pasó, el estado es
  // no_asistio o justificado, y el servicio no está cancelado.
  const puedeJustificar =
    esPostEvento && (evento.mi_estado === 'no_asistio' || evento.mi_estado === 'justificado');

  return (
    <View className="mb-2 rounded-lg border border-slate-200 border-l-4 border-l-primary-500 bg-white p-3">
      <View className="flex-row items-center gap-2">
        <View className="rounded-full bg-primary-100 px-2 py-0.5">
          <Text className="text-xs font-medium text-primary-700">Servicio</Text>
        </View>
        <Text className="text-lg font-semibold text-slate-900">
          {formatearHora(evento.fecha_inicio)}
        </Text>
        {evento.titulo ? (
          <Text className="flex-1 text-sm text-slate-600" numberOfLines={1}>
            {evento.titulo}
          </Text>
        ) : null}
      </View>
      {evento.lugar ? (
        <Text className="mt-1 text-xs text-slate-500">📍 {evento.lugar}</Text>
      ) : null}
      {evento.mis_roles.length > 0 ? (
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {evento.mis_roles.map((r: RolServicio, i: number) => (
            <View
              key={`${r}-${i}`}
              className="flex-row items-center rounded-full bg-primary-100 px-2.5 py-0.5"
            >
              <Text className="mr-1 text-xs">{ROLES_EMOJI[r]}</Text>
              <Text className="text-xs font-medium text-primary-700">{ROLES_LABELS[r]}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Badge de estado de asistencia (si ya pasó) */}
      {esPostEvento && evento.mi_estado ? (
        <View className="mt-2.5 flex-row items-center gap-2">
          {evento.mi_estado === 'asistio' ? (
            <View className="rounded-full bg-emerald-100 px-2.5 py-0.5">
              <Text className="text-xs font-medium text-emerald-700">✓ Asististe</Text>
            </View>
          ) : evento.mi_estado === 'no_asistio' ? (
            <View className="rounded-full bg-red-100 px-2.5 py-0.5">
              <Text className="text-xs font-medium text-red-700">✗ No asististe</Text>
            </View>
          ) : (
            <View className="rounded-full bg-amber-100 px-2.5 py-0.5">
              <Text className="text-xs font-medium text-amber-700">Justificado</Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Justificación (RF-097: visible para todos) */}
      {evento.mi_justificacion ? (
        <View className="mt-2 rounded-md bg-slate-50 p-2.5">
          <Text className="text-xs italic text-slate-700">
            "{evento.mi_justificacion}"
          </Text>
        </View>
      ) : null}

      {/* CTA Justificar (RF-096) */}
      {puedeJustificar ? (
        <Pressable
          onPress={() => onJustificar(evento.id)}
          className="mt-3 items-center rounded-md border border-amber-500 bg-amber-50 px-3 py-2 active:bg-amber-100"
        >
          <Text className="text-sm font-semibold text-amber-700">
            {evento.mi_justificacion ? '✏️ Editar justificación' : '📝 Justificar inasistencia'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MiEnsayoCardUI({ evento }: { evento: MiEventoEnsayo }) {
  return (
    <View className="mb-2 rounded-lg border border-slate-200 border-l-4 border-l-amber-500 bg-white p-3">
      <View className="flex-row items-center gap-2">
        <View className="rounded-full bg-amber-100 px-2 py-0.5">
          <Text className="text-xs font-medium text-amber-700">🎵 Ensayo</Text>
        </View>
        <Text className="text-lg font-semibold text-slate-900">
          {formatearHora(evento.fecha_inicio)}
        </Text>
        <Text className="flex-1 text-sm text-slate-600" numberOfLines={1}>
          {evento.titulo}
        </Text>
      </View>
      {evento.lugar ? (
        <Text className="mt-1 text-xs text-slate-500">📍 {evento.lugar}</Text>
      ) : null}
    </View>
  );
}
