import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { useSolicitudesPendientes } from '@/features/solicitudes/hooks';
import { SolicitudDetallada } from '@/features/solicitudes/types';
import { useGrupoActivoStore } from '@/stores/grupoActivo';
import { formatearDiaCorto, formatearHora } from '@/features/asignaciones/types';

/**
 * Inbox de solicitudes pendientes para el admin del grupo activo
 * (RF-021).
 *
 * El admin ve TODAS las solicitudes pendientes del grupo activo, las
 * más antiguas primero (para evitar favoritismos por orden de
 * llegada). Tap en una solicitud abre el detalle para aprobar o
 * rechazar.
 *
 * Decisiones:
 * - El inbox es POR GRUPO. Si el admin tiene varios grupos,
 *   navega al grupo desde el home y luego a la sección de
 *   solicitudes de ese grupo. En v0.1.0 con MVP + un admin por
 *   grupo, esto es suficiente.
 * - El inbox NO muestra aprobadas/rechazadas históricas. Es solo
 *   la cola de pendientes. El historial se puede ver con filtros
 *   (v0.2.0).
 */
export default function SolicitudesScreen() {
  const router = useRouter();
  const grupoActivo = useGrupoActivoStore((s) => s.grupo);
  const grupoId = grupoActivo?.id ?? '';

  const { solicitudes, loading, error, refetch } = useSolicitudesPendientes(grupoId);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  if (!grupoActivo) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Stack.Screen options={{ title: 'Solicitudes' }} />
        <Text className="text-center text-base font-semibold text-slate-700">
          Seleccioná un grupo primero
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Solicitudes',
          headerBackTitle: 'Atrás',
        }}
      />

      {error ? (
        <View className="border-b border-red-200 bg-red-50 px-4 py-3">
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      ) : null}

      {solicitudes.length === 0 && !loading ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-lg font-semibold text-slate-700">
            No hay solicitudes pendientes
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-500">
            Cuando alguien quiera unirse a {grupoActivo.nombre}, lo vas a ver
            acá.
          </Text>
        </View>
      ) : (
        <FlatList
          data={solicitudes}
          keyExtractor={(s) => s.id}
          contentContainerClassName="p-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <SolicitudCard
              solicitud={item}
              onPress={() => router.push(`/(app)/solicitudes/${item.id}`)}
            />
          )}
        />
      )}

      {loading && solicitudes.length === 0 ? (
        <View className="flex-1 items-center justify-center bg-slate-50">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : null}
    </>
  );
}

function SolicitudCard({
  solicitud,
  onPress,
}: {
  solicitud: SolicitudDetallada;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-lg border border-slate-200 bg-white p-4 active:bg-slate-50"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-base font-semibold text-slate-900">
            {solicitud.solicitante.nombre} {solicitud.solicitante.apellido}
          </Text>
          <Text className="text-xs text-slate-500">{solicitud.solicitante.email}</Text>
        </View>
        <View className="rounded-full bg-amber-100 px-2.5 py-0.5">
          <Text className="text-xs font-medium text-amber-700">Pendiente</Text>
        </View>
      </View>
      {solicitud.mensaje ? (
        <Text className="mt-2 text-sm italic text-slate-700" numberOfLines={3}>
          "{solicitud.mensaje}"
        </Text>
      ) : null}
      <Text className="mt-2 text-xs text-slate-400">
        Solicitó el {formatearDiaCorto(new Date(solicitud.created_at))} a las{' '}
        {formatearHora(solicitud.created_at)}
      </Text>
    </Pressable>
  );
}
