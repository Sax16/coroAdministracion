import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { useComunicados } from '@/features/comunicados/hooks';
import { Comunicado } from '@/features/comunicados/types';
import { GrupoConRol, listarMisGrupos } from '@/features/grupos/api';
import { useAuthStore } from '@/stores/auth';
import { formatearDiaCorto, formatearHora } from '@/features/asignaciones/types';

/**
 * Pantalla de listado de comunicados (RF-082).
 *
 * Vista cronológica descendente (más reciente primero). Tanto miembros
 * como admins pueden ver (RLS: select para todos los miembros del
 * grupo). El admin tiene un botón "+ Nuevo comunicado" abajo a la
 * derecha.
 *
 * Decisiones:
 * - Cada comunicado con `fecha_inicio` se muestra con un badge
 *   "📅 EVENTO" arriba, para diferenciarlo de los que son solo texto.
 * - Si el comunicado tiene `lugar`, se muestra como "📍 Lugar".
 * - No hay paginación por ahora (límite de 50 en la query). Si el
 *   volumen crece, se puede agregar.
 */
export default function ComunicadosScreen() {
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
      const r = await listarMisGrupos();
      if (cancelado) return;
      if (r.ok) {
        const g = (r.data as GrupoConRol[]).find((x) => x.id === grupoId);
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

  const { comunicados, loading, error, refetch } = useComunicados(grupoId ?? '');

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
          title: nombreGrupo ? `Comunicados — ${nombreGrupo}` : 'Comunicados',
          headerBackTitle: 'Atrás',
        }}
      />

      {error ? (
        <View className="border-b border-red-200 bg-red-50 px-4 py-3">
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      ) : null}

      {comunicados.length === 0 && !loading ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-lg font-semibold text-slate-700">
            No hay comunicados todavía
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-500">
            Los comunicados que el admin publique aparecerán acá, en orden cronológico.
          </Text>
          {esAdmin ? (
            <Pressable
              onPress={() => router.push(`/(app)/grupos/${grupoId}/comunicados/crear`)}
              className="mt-6 h-12 items-center justify-center rounded-lg bg-primary-600 px-6 active:bg-primary-700"
            >
              <Text className="text-base font-semibold text-white">+ Nuevo comunicado</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={comunicados}
          keyExtractor={(c) => c.id}
          contentContainerClassName="p-4"
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <ComunicadoCard
              comunicado={item}
              onPress={() =>
                router.push(`/(app)/grupos/${grupoId}/comunicados/${item.id}`)
              }
            />
          )}
          ListFooterComponent={
            esAdmin ? (
              <Pressable
                onPress={() => router.push(`/(app)/grupos/${grupoId}/comunicados/crear`)}
                className="mt-4 h-12 items-center justify-center rounded-lg bg-primary-600 active:bg-primary-700"
              >
                <Text className="text-base font-semibold text-white">+ Nuevo comunicado</Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </>
  );
}

function ComunicadoCard({
  comunicado,
  onPress,
}: {
  comunicado: Comunicado;
  onPress: () => void;
}) {
  const esEvento = !!comunicado.fecha_inicio;
  const fechaCreacion = new Date(comunicado.created_at);

  return (
    <Pressable
      onPress={onPress}
      className="rounded-lg border border-slate-200 bg-white p-4 active:bg-slate-50"
    >
      {esEvento ? (
        <View className="mb-2 self-start rounded-full bg-amber-100 px-2 py-0.5">
          <Text className="text-xs font-medium text-amber-700">📅 Evento</Text>
        </View>
      ) : null}

      <Text className="text-base font-semibold text-slate-900" numberOfLines={2}>
        {comunicado.titulo}
      </Text>

      {esEvento ? (
        <Text className="mt-1 text-sm font-medium text-slate-700">
          {formatearDiaCorto(new Date(comunicado.fecha_inicio!))} ·{' '}
          {formatearHora(comunicado.fecha_inicio!)}
          {comunicado.lugar ? `  · 📍 ${comunicado.lugar}` : ''}
        </Text>
      ) : null}

      <Text className="mt-2 text-sm text-slate-600" numberOfLines={3}>
        {comunicado.descripcion}
      </Text>

      <Text className="mt-3 text-xs text-slate-400">
        Publicado el {formatearDiaCorto(fechaCreacion)} a las {formatearHora(comunicado.created_at)}
      </Text>
    </Pressable>
  );
}
