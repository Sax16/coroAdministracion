import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { useEnsayosProximos } from '@/features/ensayos/hooks';
import { EnsayoConEncargado } from '@/features/ensayos/types';
import { GrupoConRol, listarMisGrupos } from '@/features/grupos/api';
import { useAuthStore } from '@/stores/auth';
import {
  formatearDiaCorto,
  formatearHora,
  getDiasSemana,
  getLunesSemana,
} from '@/features/asignaciones/types';

/**
 * Pantalla de listado de ensayos del grupo (RF-074).
 *
 * Muestra ensayos PRÓXIMOS agrupados por día (lunes a domingo de la
 * semana actual), ordenados por hora. El admin ve un FAB "+ Nuevo ensayo"
 * abajo a la derecha que navega a crear.
 *
 * Diferencia con la vista de asignaciones/servicios: los ensayos NO
 * tienen asignaciones de roles, solo un encargado y una lista de
 * invitados. El layout es más simple.
 *
 * Los ensayos cancelados NO aparecen (la API los excluye por default).
 * Para verlos habría que ir al detalle de un ensayo y reabrirlo.
 */
export default function EnsayosScreen() {
  const router = useRouter();
  const { id: grupoId } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const [esAdmin, setEsAdmin] = useState(false);
  const [nombreGrupo, setNombreGrupo] = useState<string | null>(null);
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

  const { ensayos, loading, error, refetch } = useEnsayosProximos(grupoId ?? '');

  const lunes = useMemo(() => getLunesSemana(new Date()), []);
  const dias = useMemo(() => getDiasSemana(lunes), [lunes]);

  const ensayosPorDia = useMemo(() => {
    const map = new Map<string, EnsayoConEncargado[]>();
    for (const e of ensayos) {
      const key = new Date(e.fecha_inicio).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [ensayos]);

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
          title: nombreGrupo ? `Ensayos — ${nombreGrupo}` : 'Ensayos',
          headerBackTitle: 'Atrás',
        }}
      />

      {error ? (
        <View className="border-b border-red-200 bg-red-50 px-4 py-3">
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      ) : null}

      {ensayos.length === 0 && !loading ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-lg font-semibold text-slate-700">
            No hay ensayos próximos
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-500">
            Los ensayos que crees aparecerán acá. Si querés ver los pasados,
            están en el historial (próximamente).
          </Text>
          {esAdmin ? (
            <Pressable
              onPress={() => router.push(`/(app)/grupos/${grupoId}/ensayos/crear`)}
              className="mt-6 h-12 items-center justify-center rounded-lg bg-primary-600 px-6 active:bg-primary-700"
            >
              <Text className="text-base font-semibold text-white">+ Nuevo ensayo</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={dias}
          keyExtractor={(d) => d.toDateString()}
          contentContainerClassName="p-4"
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
          renderItem={({ item: dia, index }) => {
            const items = ensayosPorDia.get(dia.toDateString()) ?? [];
            return (
              <View className="mb-4">
                <View className="mb-2 flex-row items-baseline">
                  <Text className="text-sm font-semibold text-slate-500">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][index]}
                  </Text>
                  <Text className="ml-2 text-base font-semibold text-slate-900">
                    {formatearDiaCorto(dia)}
                  </Text>
                </View>
                {items.length === 0 ? (
                  <View className="rounded-lg border border-dashed border-slate-200 bg-white p-3">
                    <Text className="text-sm text-slate-400">Sin ensayos</Text>
                  </View>
                ) : (
                  items.map((e) => (
                    <EnsayoCard
                      key={e.id}
                      ensayo={e}
                      onPress={() =>
                        router.push(`/(app)/grupos/${grupoId}/ensayos/${e.id}`)
                      }
                    />
                  ))
                )}
              </View>
            );
          }}
          ListFooterComponent={
            esAdmin ? (
              <Pressable
                onPress={() => router.push(`/(app)/grupos/${grupoId}/ensayos/crear`)}
                className="mt-4 h-12 items-center justify-center rounded-lg bg-primary-600 active:bg-primary-700"
              >
                <Text className="text-base font-semibold text-white">+ Nuevo ensayo</Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </>
  );
}

function EnsayoCard({
  ensayo,
  onPress,
}: {
  ensayo: EnsayoConEncargado;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-2 rounded-lg border border-slate-200 bg-white p-3 active:bg-slate-50"
    >
      <View className="flex-row items-baseline">
        <Text className="text-lg font-semibold text-slate-900">
          {formatearHora(ensayo.fecha_inicio)}
        </Text>
        <Text className="ml-2 text-sm text-slate-600" numberOfLines={1}>
          {ensayo.titulo}
        </Text>
      </View>
      {ensayo.lugar ? (
        <Text className="mt-1 text-xs text-slate-500">📍 {ensayo.lugar}</Text>
      ) : null}
      {ensayo.tema ? (
        <Text className="mt-1 text-xs italic text-slate-500" numberOfLines={1}>
          🎵 {ensayo.tema}
        </Text>
      ) : null}
      {ensayo.encargado ? (
        <Text className="mt-1.5 text-xs text-primary-600">
          Encargado: {ensayo.encargado.nombre} {ensayo.encargado.apellido}
        </Text>
      ) : null}
    </Pressable>
  );
}
