import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { useComunicado, useGestionComunicados } from '@/features/comunicados/hooks';
import { GrupoConRol, listarMisGrupos } from '@/features/grupos/api';
import { formatearDiaCorto, formatearHora } from '@/features/asignaciones/types';
import { useAuthStore } from '@/stores/auth';

/**
 * Pantalla de detalle de un comunicado.
 *
 * Muestra: título, descripción completa, fecha y lugar si los tiene,
 * fecha de publicación. Si es admin, tiene CTAs para editar y
 * eliminar (RF-081).
 *
 * El comunicado es solo lectura para miembros (no hay likes, no hay
 * comentarios, no hay RSVP). Es una vía de comunicación de una sola
 * dirección (RF-084).
 */
export default function DetalleComunicadoScreen() {
  const router = useRouter();
  const { id: grupoId, comunicadoId } = useLocalSearchParams<{
    id: string;
    comunicadoId: string;
  }>();
  const user = useAuthStore((s) => s.user);

  const { comunicado, loading } = useComunicado(comunicadoId ?? '');
  const { eliminar, loading: eliminando } = useGestionComunicados();

  const [esAdmin, setEsAdmin] = useState(false);
  const [cargandoGrupo, setCargandoGrupo] = useState(true);

  useEffect(() => {
    if (!grupoId || !user) return;
    let cancelado = false;
    (async () => {
      const r = await listarMisGrupos();
      if (cancelado) return;
      if (r.ok) {
        const g = (r.data as GrupoConRol[]).find((x) => x.id === grupoId);
        if (g) setEsAdmin(g.rol === 'admin');
      }
      setCargandoGrupo(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [grupoId, user]);

  const onEliminar = useCallback(() => {
    if (!comunicado) return;
    Alert.alert(
      'Eliminar comunicado',
      'Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const ok = await eliminar(comunicado.id);
            if (ok) {
              Alert.alert('Comunicado eliminado', '', [
                { text: 'OK', onPress: () => router.replace(`/(app)/grupos/${grupoId}/comunicados`) },
              ]);
            }
          },
        },
      ],
    );
  }, [comunicado, eliminar, grupoId, router]);

  if (loading || cargandoGrupo) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!comunicado) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Text className="text-base text-slate-700">Comunicado no encontrado</Text>
      </View>
    );
  }

  const esEvento = !!comunicado.fecha_inicio;
  const fechaPublicacion = new Date(comunicado.created_at);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Comunicado',
          headerBackTitle: 'Atrás',
        }}
      />

      <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="pb-10">
        <View className="m-4 rounded-lg border border-slate-200 bg-white p-4">
          {esEvento ? (
            <View className="mb-3 self-start rounded-full bg-amber-100 px-2.5 py-0.5">
              <Text className="text-xs font-medium text-amber-700">📅 Evento</Text>
            </View>
          ) : null}

          <Text className="text-2xl font-bold text-slate-900">{comunicado.titulo}</Text>

          {esEvento ? (
            <View className="mt-3 rounded-md bg-amber-50 p-3">
              <Text className="text-sm font-medium text-amber-900">
                {formatearDiaCorto(new Date(comunicado.fecha_inicio!))} ·{' '}
                {formatearHora(comunicado.fecha_inicio!)}
              </Text>
              {comunicado.lugar ? (
                <Text className="mt-1 text-sm text-amber-800">📍 {comunicado.lugar}</Text>
              ) : null}
            </View>
          ) : null}

          <Text className="mt-4 text-base leading-6 text-slate-700">
            {comunicado.descripcion}
          </Text>

          <Text className="mt-4 text-xs text-slate-400">
            Publicado el {formatearDiaCorto(fechaPublicacion)} a las{' '}
            {formatearHora(comunicado.created_at)}
          </Text>
        </View>

        {/* Acciones admin */}
        {esAdmin ? (
          <View className="mx-4 mt-2 gap-2">
            <Button
              title="Editar"
              variant="secondary"
              onPress={() =>
                router.push(`/(app)/grupos/${grupoId}/comunicados/${comunicado.id}/editar`)
              }
            />
            <Button
              title="Eliminar comunicado"
              variant="danger"
              onPress={onEliminar}
              loading={eliminando}
            />
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
