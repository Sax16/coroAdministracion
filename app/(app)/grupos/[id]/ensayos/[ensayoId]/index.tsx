import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { useEnsayo, useGestionEnsayos, useInvitadosEnsayo, useMiembrosGrupo } from '@/features/ensayos/hooks';
import { GrupoConRol, listarMisGrupos } from '@/features/grupos/api';
import { notificarPush } from '@/lib/pushApi';
import { formatearDiaLargo, formatearHora } from '@/features/asignaciones/types';
import { useAuthStore } from '@/stores/auth';

/**
 * Pantalla de detalle de un ensayo.
 *
 * Muestra: título, fecha, lugar, descripción, tema, encargado, invitados.
 * Si es admin: CTAs para editar, cancelar/reabrir, asignar encargado,
 * invitar/quitar miembros.
 *
 * El cierre de asistencia (RF-075) es v0.2.0 — no se muestra en MVP.
 */
export default function DetalleEnsayoScreen() {
  const router = useRouter();
  const { id: grupoId, ensayoId } = useLocalSearchParams<{
    id: string;
    ensayoId: string;
  }>();
  const user = useAuthStore((s) => s.user);

  const { ensayo, loading, refetch } = useEnsayo(ensayoId ?? '');
  const { invitados, refetch: refetchInv } = useInvitadosEnsayo(ensayoId ?? '');
  const { miembros } = useMiembrosGrupo(grupoId ?? '');
  const { cancelar, reabrir, asignarEncargado, invitar, quitarInvitado, loading: mutando } =
    useGestionEnsayos();

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
        if (g) setEsAdmin(g.rol === 'admin');
      }
      setCargandoGrupo(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [grupoId, user]);

  const onCancelar = useCallback(() => {
    if (!ensayo) return;
    Alert.alert(
      'Cancelar ensayo',
      'Los miembros invitados serán notificados con un push.',
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cancelar ensayo',
          style: 'destructive',
          onPress: async () => {
            const ok = await cancelar(ensayo.id);
            if (ok) {
              await notificarPush('ensayo_cancelado', {
                grupo_id: grupoId,
                ensayo_id: ensayo.id,
                titulo: ensayo.titulo,
                fecha_inicio: ensayo.fecha_inicio,
                lugar: ensayo.lugar,
              });
              await refetch();
            }
          },
        },
      ],
    );
  }, [ensayo, cancelar, grupoId, refetch]);

  const onReabrir = useCallback(async () => {
    if (!ensayo) return;
    const ok = await reabrir(ensayo.id);
    if (ok) await refetch();
  }, [ensayo, reabrir, refetch]);

  const onAsignarEncargado = useCallback(
    async (usuarioId: string) => {
      if (!ensayo) return;
      const ok = await asignarEncargado(ensayo.id, usuarioId);
      if (ok) await refetch();
    },
    [ensayo, asignarEncargado, refetch],
  );

  const onInvitar = useCallback(
    async (usuarioGrupoId: string) => {
      if (!ensayo) return;
      const ok = await invitar(ensayo.id, usuarioGrupoId);
      if (ok) {
        // Push individual al invitado
        const m = miembros.find((x) => x.usuario_grupo_id === usuarioGrupoId);
        if (m) {
          await notificarPush('asignacion_nueva', {
            grupo_id: grupoId,
            servicio_id: ensayo.id, // reutilizamos el tipo (es genérico)
            titulo: `Ensayo: ${ensayo.titulo}`,
            fecha_inicio: ensayo.fecha_inicio,
            lugar: ensayo.lugar,
            usuario_id: m.usuario_id,
          });
        }
        await refetchInv();
      }
    },
    [ensayo, invitar, miembros, grupoId, refetchInv],
  );

  const onQuitarInvitado = useCallback(
    async (usuarioGrupoId: string) => {
      if (!ensayo) return;
      Alert.alert('Quitar invitado', '¿Sacar a este miembro del ensayo?', [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            const ok = await quitarInvitado(ensayo.id, usuarioGrupoId);
            if (ok) await refetchInv();
          },
        },
      ]);
    },
    [ensayo, quitarInvitado, refetchInv],
  );

  if (loading || cargandoGrupo) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!ensayo) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Text className="text-base text-slate-700">Ensayo no encontrado</Text>
      </View>
    );
  }

  const fecha = new Date(ensayo.fecha_inicio);
  const invitadosSet = new Set(invitados.map((i) => i.miembro.usuario_grupo_id));
  const noInvitados = miembros.filter((m) => !invitadosSet.has(m.usuario_grupo_id));

  return (
    <>
      <Stack.Screen
        options={{
          title: ensayo.titulo,
          headerBackTitle: 'Atrás',
        }}
      />

      <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="pb-10">
        {/* Encabezado */}
        <View className="m-4 rounded-lg border border-slate-200 bg-white p-4">
          <Text className="text-sm text-slate-500">{formatearDiaLargo(fecha)}</Text>
          <Text className="mt-1 text-3xl font-bold text-slate-900">
            {formatearHora(ensayo.fecha_inicio)}
          </Text>
          {ensayo.fecha_fin ? (
            <Text className="text-sm text-slate-600">
              hasta {formatearHora(ensayo.fecha_fin)}
            </Text>
          ) : null}
          {ensayo.lugar ? (
            <Text className="mt-2 text-sm text-slate-700">📍 {ensayo.lugar}</Text>
          ) : null}
          {ensayo.estado === 'cancelado' ? (
            <View className="mt-3 self-start rounded-full bg-slate-200 px-2.5 py-0.5">
              <Text className="text-xs font-medium text-slate-600">Cancelado</Text>
            </View>
          ) : null}
        </View>

        {ensayo.tema ? (
          <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
            <Text className="text-sm font-semibold text-slate-500">🎵 Tema a ensayar</Text>
            <Text className="mt-1 text-base text-slate-900">{ensayo.tema}</Text>
          </View>
        ) : null}

        {ensayo.descripcion ? (
          <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
            <Text className="text-sm font-semibold text-slate-500">Descripción</Text>
            <Text className="mt-1 text-sm text-slate-700">{ensayo.descripcion}</Text>
          </View>
        ) : null}

        {/* Encargado */}
        <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
          <Text className="text-sm font-semibold text-slate-500">Encargado</Text>
          {ensayo.encargado ? (
            <Text className="mt-1 text-base text-slate-900">
              {ensayo.encargado.nombre} {ensayo.encargado.apellido}
            </Text>
          ) : (
            <Text className="mt-1 text-sm italic text-slate-400">Sin asignar</Text>
          )}
          {esAdmin && ensayo.estado === 'programado' ? (
            <View className="mt-3">
              <Text className="mb-1.5 text-xs font-medium text-slate-500">Cambiar a:</Text>
              <View className="gap-1.5">
                {miembros.map((m) => (
                  <Pressable
                    key={m.usuario_grupo_id}
                    onPress={() => onAsignarEncargado(m.usuario_id)}
                    disabled={mutando}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 active:bg-slate-50"
                  >
                    <Text className="text-sm text-slate-700">
                      {m.nombre} {m.apellido}
                      {m.rol === 'admin' ? ' (admin)' : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* Invitados */}
        <View className="mx-4 mb-3">
          <Text className="mb-2 text-sm font-semibold text-slate-500">
            Invitados ({invitados.length})
          </Text>
          {invitados.length === 0 ? (
            <View className="rounded-lg border border-dashed border-slate-200 bg-white p-3">
              <Text className="text-sm text-slate-400">Sin invitados todavía</Text>
            </View>
          ) : (
            invitados.map((inv) => (
              <View
                key={inv.id}
                className="mb-1.5 flex-row items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
              >
                <Text className="text-sm text-slate-900">
                  {inv.miembro.nombre} {inv.miembro.apellido}
                </Text>
                {esAdmin && ensayo.estado === 'programado' ? (
                  <Pressable
                    onPress={() => onQuitarInvitado(inv.miembro.usuario_grupo_id)}
                    className="rounded-md border border-red-200 px-2.5 py-1 active:bg-red-50"
                  >
                    <Text className="text-xs font-medium text-red-600">Quitar</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}

          {/* Agregar invitados (solo admin) */}
          {esAdmin && ensayo.estado === 'programado' && noInvitados.length > 0 ? (
            <View className="mt-2">
              <Text className="mb-1.5 text-xs font-medium text-slate-500">Invitar a:</Text>
              <View className="gap-1.5">
                {noInvitados.map((m) => (
                  <Pressable
                    key={m.usuario_grupo_id}
                    onPress={() => onInvitar(m.usuario_grupo_id)}
                    disabled={mutando}
                    className="flex-row items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 active:bg-slate-50"
                  >
                    <Text className="text-sm text-slate-700">
                      {m.nombre} {m.apellido}
                    </Text>
                    <Text className="text-xs font-semibold text-primary-600">+ Invitar</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* Acciones admin */}
        {esAdmin ? (
          <View className="mx-4 mt-2 gap-2">
            {ensayo.estado === 'programado' ? (
              <>
                <Button
                  title="Editar ensayo"
                  variant="secondary"
                  onPress={() =>
                    router.push(`/(app)/grupos/${grupoId}/ensayos/${ensayo.id}/editar`)
                  }
                />
                <Button title="Cancelar ensayo" variant="danger" onPress={onCancelar} />
              </>
            ) : ensayo.estado === 'cancelado' ? (
              <Button title="Reabrir ensayo" variant="secondary" onPress={onReabrir} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
